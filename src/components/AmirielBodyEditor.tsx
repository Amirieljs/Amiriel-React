import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import {
  AMIRIEL_FONT_OPTIONS,
  AMIRIEL_TEXT_COLORS,
  AMIRIEL_TEXT_COLOR_OPTIONS,
  amirielThemeCssVars,
  createAmirielId,
  findAmirielThemeDefinition,
  formatAmirielLabel,
  mediaAspectRatio,
  mediaSizeWithinPaper,
  mergeAmirielThemeDefinitions,
  normalizeDocument,
  normalizePaperSize,
  normalizePaperSizeLimits,
  resolveAmirielLabels,
  syncPageText,
  themeDefaultTextColorFor,
  type AmirielDocument,
  type AmirielEditorLimits,
  type AmirielFont,
  type AmirielLabels,
  type AmirielLocale,
  type AmirielMedia,
  type AmirielMediaPlacement,
  type AmirielMediaRequest,
  type AmirielPage,
  type AmirielPaperSize,
  type AmirielPaperSizeLimits,
  type AmirielTextBlock,
  type AmirielTextColor,
  type AmirielThemeDefinition,
} from "amiriel";
import { AmirielBodyRenderer } from "./AmirielBodyRenderer";
import { AmirielMediaLightbox } from "./AmirielMediaLightbox";
import { AmirielMediaVideo } from "./AmirielMediaVideo";

export interface AmirielBodyEditorProps {
  value: AmirielDocument;
  onChange: (value: AmirielDocument) => void;
  readOnly?: boolean;
  limits?: AmirielEditorLimits;
  locale?: AmirielLocale;
  labels?: Partial<AmirielLabels>;
  themes?: AmirielThemeDefinition[];
  accept?: string;
  onMediaRequest?: (request: AmirielMediaRequest<File>) => void | Promise<void>;
  onMediaRemoved?: (media: AmirielMedia) => void;
  defaultPaperSize?: AmirielPaperSize;
  paperSizeLimits?: AmirielPaperSizeLimits;
  paperResizable?: boolean;
  className?: string;
  style?: CSSProperties;
}

type PaperDimension = "width" | "height";

function nextZ(page: AmirielPage) {
  return Math.max(
    0,
    ...(page.mediaPlacements ?? []).map((placement) => placement.z),
    ...(page.textBlocks ?? []).map((block) => block.z),
  ) + 1;
}

function syncPageMediaIds(page: AmirielPage) {
  page.mediaIds = Array.from(new Set((page.mediaPlacements ?? []).map((placement) => placement.mediaId)));
}

function mediaThumbnail(item: AmirielMedia) {
  return item.thumbnailUrl || item.url;
}

export function AmirielBodyEditor({
  value,
  onChange,
  readOnly = false,
  limits,
  locale = "en",
  labels,
  themes,
  accept = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime",
  onMediaRequest,
  onMediaRemoved,
  defaultPaperSize,
  paperSizeLimits,
  paperResizable = true,
  className,
  style,
}: AmirielBodyEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [lightboxMedia, setLightboxMedia] = useState<AmirielMedia | null>(null);

  const normalizeOptions = useMemo(() => ({
    defaultPaperSize,
    paperSizeLimits,
    paperResizable,
  }), [defaultPaperSize, paperResizable, paperSizeLimits]);
  const draft = useMemo(() => normalizeDocument(value, normalizeOptions), [normalizeOptions, value]);
  const resolvedLabels = useMemo(() => resolveAmirielLabels(locale, labels), [labels, locale]);
  const resolvedThemes = useMemo(() => mergeAmirielThemeDefinitions(themes), [themes]);
  const activePaperSize = useMemo(() => normalizePaperSize(draft.paper, normalizeOptions), [draft.paper, normalizeOptions]);
  const activePaperSizeLimits = useMemo(() => normalizePaperSizeLimits(paperSizeLimits), [paperSizeLimits]);
  const activeThemeStyle = useMemo(
    () => amirielThemeCssVars(findAmirielThemeDefinition(draft.theme, themes)) as CSSProperties,
    [draft.theme, themes],
  );
  const resolvedLimits = useMemo(() => ({
    maxPages: limits?.maxPages ?? 20,
    maxTextBlocksPerPage: limits?.maxTextBlocksPerPage ?? 4,
    maxImages: limits?.maxImages ?? 3,
    maxVideos: limits?.maxVideos ?? 1,
  }), [limits]);
  const selectedPage = draft.pages.find((page) => page.id === selectedPageId) ?? draft.pages[0];
  const selectedPageIndex = Math.max(0, draft.pages.findIndex((page) => page.id === selectedPage?.id));
  const mediaCounts = {
    images: draft.media.filter((item) => item.type === "image").length,
    videos: draft.media.filter((item) => item.type === "video").length,
  };
  const pageLimitReached = draft.pages.length >= resolvedLimits.maxPages;
  const uploadLimitReached =
    mediaCounts.images >= resolvedLimits.maxImages &&
    mediaCounts.videos >= resolvedLimits.maxVideos;

  useEffect(() => {
    if (!draft.pages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(draft.pages[0]?.id ?? "");
    }
  }, [draft.pages, selectedPageId]);

  function commit(updater: (next: AmirielDocument) => void, nextSelectedPageId?: string) {
    const next = normalizeDocument(value, normalizeOptions);
    updater(next);
    const normalized = normalizeDocument(next, normalizeOptions);
    onChange(normalized);
    if (nextSelectedPageId) setSelectedPageId(nextSelectedPageId);
  }

  function label(template: string, values: Record<string, string | number>) {
    return formatAmirielLabel(template, values);
  }

  function selectTheme(themeId: string) {
    if (readOnly) return;
    commit((next) => {
      next.theme = themeId;
      for (const page of next.pages) {
        for (const block of page.textBlocks ?? []) {
          if (!block.color) block.color = themeDefaultTextColorFor(themeId, themes);
        }
      }
    });
  }

  function updatePaperDimension(dimension: PaperDimension, event: ChangeEvent<HTMLInputElement>) {
    if (readOnly || !paperResizable) return;
    const raw = Number(event.currentTarget.value);
    if (!Number.isFinite(raw)) return;
    const min = dimension === "width" ? activePaperSizeLimits.minWidth : activePaperSizeLimits.minHeight;
    const max = dimension === "width" ? activePaperSizeLimits.maxWidth : activePaperSizeLimits.maxHeight;
    commit((next) => {
      next.paper = normalizePaperSize({
        ...activePaperSize,
        [dimension]: Math.min(max, Math.max(min, raw)),
      }, normalizeOptions);
    });
  }

  function addPage() {
    if (readOnly || pageLimitReached) return;
    const pageId = createAmirielId("page");
    commit((next) => {
      next.pages.push({
        id: pageId,
        order: next.pages.length,
        text: "",
        font: "handwritten",
        mediaIds: [],
        mediaPlacements: [],
        textBlocks: [],
      });
    }, pageId);
  }

  function removeSelectedPage() {
    if (readOnly || draft.pages.length <= 1 || !selectedPage) return;
    const removedIndex = selectedPageIndex;
    let nextSelectedId = "";
    commit((next) => {
      next.pages = next.pages
        .filter((page) => page.id !== selectedPage.id)
        .map((page, index) => ({ ...page, order: index }));
      nextSelectedId = next.pages[Math.max(removedIndex - 1, 0)]?.id ?? next.pages[0]?.id ?? "";
    }, nextSelectedId);
  }

  function addTextBlock() {
    if (readOnly || !selectedPage) return;
    if ((selectedPage.textBlocks ?? []).length >= resolvedLimits.maxTextBlocksPerPage) return;
    commit((next) => {
      const page = next.pages.find((item) => item.id === selectedPage.id);
      if (!page) return;
      const block: AmirielTextBlock = {
        id: createAmirielId("text"),
        x: 8,
        y: 18 + (page.textBlocks ?? []).length * 10,
        width: 56,
        height: 18,
        text: "",
        z: nextZ(page),
        font: page.font || "handwritten",
        fontSize: 16,
        color: themeDefaultTextColorFor(next.theme, themes),
      };
      page.textBlocks = [...(page.textBlocks ?? []), block];
      syncPageText(page);
    });
  }

  function updateTextBlock(blockId: string, updater: (block: AmirielTextBlock) => void) {
    if (readOnly || !selectedPage) return;
    commit((next) => {
      const page = next.pages.find((item) => item.id === selectedPage.id);
      const block = page?.textBlocks?.find((item) => item.id === blockId);
      if (!page || !block) return;
      updater(block);
      syncPageText(page);
    });
  }

  function removeTextBlock(blockId: string) {
    if (readOnly || !selectedPage) return;
    commit((next) => {
      const page = next.pages.find((item) => item.id === selectedPage.id);
      if (!page) return;
      page.textBlocks = (page.textBlocks ?? []).filter((block) => block.id !== blockId);
      syncPageText(page);
    });
  }

  function updatePageFont(font: AmirielFont) {
    if (readOnly || !selectedPage) return;
    commit((next) => {
      const page = next.pages.find((item) => item.id === selectedPage.id);
      if (page) page.font = font;
    });
  }

  function pageHasMedia(page: AmirielPage | undefined, mediaId: string) {
    return Boolean(page?.mediaPlacements?.some((placement) => placement.mediaId === mediaId));
  }

  function addMediaToSelectedPage(mediaId: string) {
    if (readOnly || !selectedPage) return;
    commit((next) => {
      const page = next.pages.find((item) => item.id === selectedPage.id);
      const media = next.media.find((item) => item.id === mediaId);
      if (!page || !media || pageHasMedia(page, mediaId)) return;
      const aspectRatio = mediaAspectRatio(media);
      const z = nextZ(page);
      const offset = (z - 1) % 6;
      const x = 10 + (offset % 3) * 8;
      const y = 24 + Math.floor(offset / 3) * 8;
      const size = mediaSizeWithinPaper(38, aspectRatio, activePaperSize.width, activePaperSize.height, 100 - x, 100 - y);
      const placement: AmirielMediaPlacement = {
        id: createAmirielId("placement"),
        mediaId,
        x,
        y,
        width: size.width,
        height: size.height,
        aspectRatio,
        z,
      };
      page.mediaPlacements = [...(page.mediaPlacements ?? []), placement];
      syncPageMediaIds(page);
    });
  }

  function detachMediaFromSelectedPage(mediaId: string) {
    if (readOnly || !selectedPage) return;
    commit((next) => {
      const page = next.pages.find((item) => item.id === selectedPage.id);
      if (!page) return;
      page.mediaPlacements = (page.mediaPlacements ?? []).filter((placement) => placement.mediaId !== mediaId);
      syncPageMediaIds(page);
    });
  }

  function toggleMediaOnPage(mediaId: string) {
    if (pageHasMedia(selectedPage, mediaId)) {
      detachMediaFromSelectedPage(mediaId);
      return;
    }
    addMediaToSelectedPage(mediaId);
  }

  function removeMedia(id: string) {
    if (readOnly) return;
    const removed = draft.media.find((item) => item.id === id);
    commit((next) => {
      next.media = next.media.filter((item) => item.id !== id);
      next.pages = next.pages.map((page) => ({
        ...page,
        mediaIds: (page.mediaIds ?? []).filter((mediaId) => mediaId !== id),
        mediaPlacements: (page.mediaPlacements ?? []).filter((placement) => placement.mediaId !== id),
      }));
    });
    if (removed) onMediaRemoved?.(removed);
  }

  async function onMediaSelected(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || readOnly || !selectedPage || uploadBusy || uploadLimitReached) return;
    if (file.type.startsWith("image/") && mediaCounts.images >= resolvedLimits.maxImages) return;
    if (file.type.startsWith("video/") && mediaCounts.videos >= resolvedLimits.maxVideos) return;

    setUploadBusy(true);
    setUploadError("");

    try {
      if (!onMediaRequest) throw new Error(resolvedLabels.mediaUploadMissing);
      const media = await new Promise<AmirielMedia>((resolve, reject) => {
        const request: AmirielMediaRequest<File> = {
          file,
          pageId: selectedPage.id,
          resolve,
          reject: (message?: string) => reject(new Error(message || resolvedLabels.uploadFailed)),
        };
        Promise.resolve(onMediaRequest(request)).catch(reject);
        queueMicrotask(() => {
          if (!request.handled) reject(new Error(resolvedLabels.mediaUploadMissing));
        });
      });
      commit((next) => {
        next.media.push(media);
        const page = next.pages.find((item) => item.id === selectedPage.id);
        if (!page || pageHasMedia(page, media.id)) return;
        const aspectRatio = mediaAspectRatio(media);
        const z = nextZ(page);
        const offset = (z - 1) % 6;
        const x = 10 + (offset % 3) * 8;
        const y = 24 + Math.floor(offset / 3) * 8;
        const size = mediaSizeWithinPaper(38, aspectRatio, activePaperSize.width, activePaperSize.height, 100 - x, 100 - y);
        page.mediaPlacements = [...(page.mediaPlacements ?? []), {
          id: createAmirielId("placement"),
          mediaId: media.id,
          x,
          y,
          width: size.width,
          height: size.height,
          aspectRatio,
          z,
        }];
        syncPageMediaIds(page);
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : resolvedLabels.uploadFailed);
    } finally {
      setUploadBusy(false);
    }
  }

  const rootClassName = ["amiriel-react-editor", className].filter(Boolean).join(" ");

  return (
    <section className={rootClassName} style={{ ...activeThemeStyle, ...style }}>
      <div className="amiriel-react-editor__bar">
        <div className="amiriel-react-editor__pages" aria-label={resolvedLabels.pagesCount}>
          {draft.pages.map((page, index) => (
            <button
              key={page.id}
              type="button"
              className={page.id === selectedPage?.id ? "is-active" : ""}
              onClick={() => setSelectedPageId(page.id)}
            >
              {index + 1}
            </button>
          ))}
          {!readOnly ? (
            <button type="button" onClick={addPage} disabled={pageLimitReached}>
              +
            </button>
          ) : null}
        </div>

        <div className="amiriel-react-editor__themes" aria-label={resolvedLabels.themeLabel}>
          {resolvedThemes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={draft.theme === theme.id ? "is-active" : ""}
              title={theme.label || resolvedLabels.themes[theme.id] || theme.id}
              onClick={() => selectTheme(theme.id)}
              disabled={readOnly}
            >
              <span className="amiriel-react-editor__swatch" style={{ background: theme.swatch }} />
              <span>{theme.label || resolvedLabels.themes[theme.id] || theme.id}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="amiriel-react-editor__layout">
        <div className="amiriel-react-editor__workspace">
          <div className="amiriel-react-editor__preview">
            <AmirielBodyRenderer
              document={draft}
              pageIndex={selectedPageIndex}
              locale={locale}
              labels={labels}
              themes={themes}
              interactive
            />
          </div>
        </div>

        <aside className="amiriel-react-editor__side">
          {selectedPage ? (
            <section className="amiriel-react-editor__panel">
              <div className="amiriel-react-editor__panel-head">
                <h3>{label(resolvedLabels.pagesCount, { count: draft.pages.length, max: resolvedLimits.maxPages })}</h3>
                {!readOnly && draft.pages.length > 1 ? (
                  <button type="button" className="is-danger" onClick={removeSelectedPage}>
                    {resolvedLabels.removePage}
                  </button>
                ) : null}
              </div>

              <label className="amiriel-react-editor__field">
                <span>{resolvedLabels.textBlockFont}</span>
                <select value={selectedPage.font || "handwritten"} disabled={readOnly} onChange={(event) => updatePageFont(event.currentTarget.value as AmirielFont)}>
                  {AMIRIEL_FONT_OPTIONS.map((font) => (
                    <option key={font} value={font}>{resolvedLabels.fonts[font]}</option>
                  ))}
                </select>
              </label>

              {paperResizable ? (
                <div className="amiriel-react-editor__paper-fields">
                  <label className="amiriel-react-editor__field">
                    <span>{resolvedLabels.paperWidth}</span>
                    <input
                      type="number"
                      min={activePaperSizeLimits.minWidth}
                      max={activePaperSizeLimits.maxWidth}
                      value={activePaperSize.width}
                      disabled={readOnly}
                      onChange={(event) => updatePaperDimension("width", event)}
                    />
                  </label>
                  <label className="amiriel-react-editor__field">
                    <span>{resolvedLabels.paperHeight}</span>
                    <input
                      type="number"
                      min={activePaperSizeLimits.minHeight}
                      max={activePaperSizeLimits.maxHeight}
                      value={activePaperSize.height}
                      disabled={readOnly}
                      onChange={(event) => updatePaperDimension("height", event)}
                    />
                  </label>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="amiriel-react-editor__panel">
            <div className="amiriel-react-editor__panel-head">
              <h3>{label(resolvedLabels.textBlockLimit, { count: selectedPage?.textBlocks?.length ?? 0, max: resolvedLimits.maxTextBlocksPerPage })}</h3>
              {!readOnly ? (
                <button type="button" onClick={addTextBlock} disabled={!selectedPage || (selectedPage.textBlocks?.length ?? 0) >= resolvedLimits.maxTextBlocksPerPage}>
                  {resolvedLabels.addTextBlock}
                </button>
              ) : null}
            </div>

            {(selectedPage?.textBlocks ?? []).length ? (
              <div className="amiriel-react-editor__blocks">
                {(selectedPage?.textBlocks ?? []).map((block) => (
                  <div key={block.id} className="amiriel-react-editor__block">
                    <textarea
                      value={block.text}
                      placeholder={resolvedLabels.textBlockPlaceholder}
                      readOnly={readOnly}
                      onChange={(event) => updateTextBlock(block.id, (next) => {
                        next.text = event.currentTarget.value;
                      })}
                    />
                    <div className="amiriel-react-editor__block-tools">
                      <select
                        value={block.font || selectedPage?.font || "handwritten"}
                        disabled={readOnly}
                        aria-label={resolvedLabels.textBlockFont}
                        onChange={(event) => updateTextBlock(block.id, (next) => {
                          next.font = event.currentTarget.value as AmirielFont;
                        })}
                      >
                        {AMIRIEL_FONT_OPTIONS.map((font) => (
                          <option key={font} value={font}>{resolvedLabels.fonts[font]}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={10}
                        max={48}
                        value={block.fontSize || 16}
                        disabled={readOnly}
                        aria-label={resolvedLabels.textBlockFontSize}
                        onChange={(event) => updateTextBlock(block.id, (next) => {
                          next.fontSize = Number(event.currentTarget.value) || 16;
                        })}
                      />
                      <select
                        value={block.color || themeDefaultTextColorFor(draft.theme, themes)}
                        disabled={readOnly}
                        aria-label={resolvedLabels.textBlockColor}
                        onChange={(event) => updateTextBlock(block.id, (next) => {
                          next.color = event.currentTarget.value as AmirielTextColor;
                        })}
                      >
                        {AMIRIEL_TEXT_COLOR_OPTIONS.map((color) => (
                          <option key={color} value={color}>{color}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={block.bold ? "is-active" : ""}
                        disabled={readOnly}
                        onClick={() => updateTextBlock(block.id, (next) => {
                          next.bold = !next.bold;
                        })}
                      >
                        B
                      </button>
                      <button
                        type="button"
                        className={block.italic ? "is-active" : ""}
                        disabled={readOnly}
                        onClick={() => updateTextBlock(block.id, (next) => {
                          next.italic = !next.italic;
                        })}
                      >
                        I
                      </button>
                      <button
                        type="button"
                        className={block.underline ? "is-active" : ""}
                        disabled={readOnly}
                        onClick={() => updateTextBlock(block.id, (next) => {
                          next.underline = !next.underline;
                        })}
                      >
                        U
                      </button>
                      {!readOnly ? (
                        <button type="button" className="is-danger" onClick={() => removeTextBlock(block.id)}>
                          {resolvedLabels.deleteTextBlock}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="amiriel-react-editor__empty">{resolvedLabels.tapPaperHint}</p>
            )}
          </section>

          <section className="amiriel-react-editor__panel">
            <div className="amiriel-react-editor__panel-head">
              <h3>{resolvedLabels.allMediaTitle}</h3>
              {!readOnly ? (
                <>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadBusy || uploadLimitReached}>
                    {uploadBusy ? resolvedLabels.uploading : resolvedLabels.uploadMedia}
                  </button>
                  <input ref={fileInputRef} type="file" accept={accept} hidden onChange={onMediaSelected} />
                </>
              ) : null}
            </div>
            <div className="amiriel-react-editor__stats">
              <span>{label(resolvedLabels.imageQuota, { count: mediaCounts.images, max: resolvedLimits.maxImages })}</span>
              <span>{label(resolvedLabels.videoQuota, { count: mediaCounts.videos, max: resolvedLimits.maxVideos })}</span>
            </div>
            {uploadError ? <p className="amiriel-react-editor__error">{uploadError}</p> : null}

            {draft.media.length ? (
              <div className="amiriel-react-editor__media-grid">
                {draft.media.map((item) => (
                  <div key={item.id} className={pageHasMedia(selectedPage, item.id) ? "amiriel-react-editor__media-tile is-on-page" : "amiriel-react-editor__media-tile"}>
                    <button type="button" className="amiriel-react-editor__media-preview" onClick={() => setLightboxMedia(item)}>
                      {item.type === "image" ? (
                        <img src={mediaThumbnail(item)} alt={item.objectKey || resolvedLabels.image} />
                      ) : (
                        <AmirielMediaVideo media={item} showDurationBadge muted preload="metadata" />
                      )}
                    </button>
                    {!readOnly ? (
                      <div className="amiriel-react-editor__tile-actions">
                        <button type="button" onClick={() => toggleMediaOnPage(item.id)}>
                          {pageHasMedia(selectedPage, item.id) ? "-" : "+"}
                        </button>
                        <button type="button" className="is-danger" onClick={() => removeMedia(item.id)}>
                          x
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="amiriel-react-editor__empty">{resolvedLabels.mediaEmpty}</p>
            )}
          </section>
        </aside>
      </div>

      <AmirielMediaLightbox
        open={Boolean(lightboxMedia)}
        media={lightboxMedia}
        closeLabel={resolvedLabels.close}
        imageLabel={resolvedLabels.image}
        videoLabel={resolvedLabels.video}
        onClose={() => setLightboxMedia(null)}
      />
    </section>
  );
}
