import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AMIRIEL_FONT_STACKS,
  AMIRIEL_TEXT_COLORS,
  amirielThemeCssVars,
  clamp,
  combinedPageText,
  findAmirielThemeDefinition,
  heightPercentForWidth,
  mediaAspectRatio,
  normalizeDocument,
  normalizePaperSize,
  resolveAmirielLabels,
  safeAspectRatio,
  sortAmirielPages,
  type AmirielDocument,
  type AmirielLabels,
  type AmirielMedia,
  type AmirielMediaPlacement,
  type AmirielPage,
  type AmirielPaperSize,
  type AmirielPaperSizeLimits,
  type AmirielTextBlock,
  type AmirielThemeDefinition,
  type AmirielLocale,
} from "@amiriel/core";
import { AmirielMediaLightbox } from "./AmirielMediaLightbox";
import { AmirielMediaVideo } from "./AmirielMediaVideo";

export interface AmirielBodyRendererProps {
  document: AmirielDocument;
  pageIndex?: number;
  title?: string;
  locale?: AmirielLocale;
  labels?: Partial<AmirielLabels>;
  themes?: AmirielThemeDefinition[];
  variant?: "paper" | "layer";
  interactive?: boolean;
  hidden?: boolean;
  lightbox?: boolean;
  defaultPaperSize?: AmirielPaperSize;
  paperSizeLimits?: AmirielPaperSizeLimits;
  paperResizable?: boolean;
  className?: string;
  style?: CSSProperties;
  onMediaClick?: (media: AmirielMedia) => void;
}

function usePaperScale(
  frameRef: React.RefObject<HTMLElement | null>,
  paperSize: AmirielPaperSize,
  variant: "paper" | "layer",
) {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || paperSize.width <= 0 || paperSize.height <= 0) {
      setScale(1);
      return;
    }

    const refresh = () => {
      const widthScale = frame.clientWidth > 0 ? frame.clientWidth / paperSize.width : 1;
      if (variant === "layer") {
        const heightScale = frame.clientHeight > 0 ? frame.clientHeight / paperSize.height : widthScale;
        setScale(Math.min(widthScale, heightScale));
        return;
      }
      setScale(widthScale);
    };

    refresh();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", refresh);
      return () => window.removeEventListener("resize", refresh);
    }

    const observer = new ResizeObserver(refresh);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frameRef, paperSize.height, paperSize.width, variant]);

  return scale;
}

function textBlockContentStyle(block: AmirielTextBlock, page?: AmirielPage): CSSProperties {
  const font = block.font || page?.font || "handwritten";
  return {
    fontFamily: AMIRIEL_FONT_STACKS[font],
    fontSize: `${block.fontSize || 16}px`,
    fontWeight: block.bold ? 700 : undefined,
    fontStyle: block.italic ? "italic" : undefined,
    textDecoration: block.underline ? "underline" : undefined,
    ...(block.color ? { color: AMIRIEL_TEXT_COLORS[block.color] } : {}),
  };
}

function textBlockStyle(block: AmirielTextBlock): CSSProperties {
  return {
    left: `${block.x}%`,
    top: `${block.y}%`,
    width: `${block.width}%`,
    height: `${block.height || 22}%`,
    zIndex: block.z,
  };
}

export function AmirielBodyRenderer({
  document,
  pageIndex = 0,
  title,
  locale = "en",
  labels,
  themes,
  variant = "paper",
  interactive = true,
  hidden = false,
  lightbox = true,
  defaultPaperSize,
  paperSizeLimits,
  paperResizable = true,
  className,
  style,
  onMediaClick,
}: AmirielBodyRendererProps) {
  const paperFrameRef = useRef<HTMLElement | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<AmirielMedia | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const normalizeOptions = useMemo(() => ({
    defaultPaperSize,
    paperSizeLimits,
    paperResizable,
  }), [defaultPaperSize, paperResizable, paperSizeLimits]);
  const resolvedLabels = useMemo(() => resolveAmirielLabels(locale, labels), [labels, locale]);
  const normalized = useMemo(() => normalizeDocument(document, normalizeOptions), [document, normalizeOptions]);
  const activePaperSize = useMemo(() => normalizePaperSize(normalized.paper, normalizeOptions), [normalizeOptions, normalized.paper]);
  const activeThemeStyle = useMemo(
    () => amirielThemeCssVars(findAmirielThemeDefinition(normalized.theme, themes)) as CSSProperties,
    [normalized.theme, themes],
  );
  const paperScale = usePaperScale(paperFrameRef, activePaperSize, variant);
  const sortedPages = useMemo(() => sortAmirielPages(normalized.pages), [normalized.pages]);
  const currentPage = sortedPages[pageIndex] ?? sortedPages[0];
  const currentTextBlocks = currentPage?.textBlocks ?? [];

  const mediaById = useCallback((id: string) => normalized.media.find((item) => item.id === id), [normalized.media]);

  const currentPlacements = useCallback((page?: AmirielPage): AmirielMediaPlacement[] => {
    if (!page) return [];
    return page.mediaPlacements ?? [];
  }, []);

  const placementHeightPercent = useCallback((placement: AmirielMediaPlacement) => {
    const media = mediaById(placement.mediaId);
    return clamp(heightPercentForWidth(
      placement.width,
      placement.aspectRatio || mediaAspectRatio(media),
      activePaperSize.width,
      activePaperSize.height,
    ), 8, 100 - placement.y);
  }, [activePaperSize.height, activePaperSize.width, mediaById]);

  const placementStyle = useCallback((placement: AmirielMediaPlacement): CSSProperties => {
    const media = mediaById(placement.mediaId);
    return {
      left: `${placement.x}%`,
      top: `${placement.y}%`,
      width: `${placement.width}%`,
      height: `${placementHeightPercent(placement)}%`,
      aspectRatio: String(placement.aspectRatio || safeAspectRatio(media?.width, media?.height) || safeAspectRatio(placement.width, placement.height)),
      zIndex: placement.z,
    };
  }, [mediaById, placementHeightPercent]);

  function openMedia(media: AmirielMedia) {
    if (!interactive) return;
    if (onMediaClick) {
      onMediaClick(media);
      return;
    }
    if (!lightbox) return;
    setLightboxMedia(media);
    setLightboxOpen(true);
  }

  function closeMedia() {
    setLightboxOpen(false);
    setLightboxMedia(null);
  }

  const rootClassName = [
    "amiriel-renderer",
    `amiriel-renderer--${variant}`,
    hidden ? "amiriel-renderer--hidden" : "",
    className,
  ].filter(Boolean).join(" ");
  const rootStyle = { ...activeThemeStyle, ...style };
  const paperSurfaceStyle: CSSProperties = {
    width: `${activePaperSize.width}px`,
    height: `${activePaperSize.height}px`,
    transform: `scale(${paperScale})`,
  };

  const content = (
    <>
      {currentTextBlocks.length ? (
        <span className="amiriel-renderer__text-layer">
          {currentTextBlocks.map((block) => (
            <span
              key={block.id}
              className="amiriel-renderer__text-block"
              style={{ ...textBlockStyle(block), ...textBlockContentStyle(block, currentPage) }}
            >
              {block.text}
            </span>
          ))}
        </span>
      ) : (
        <p
          className={variant === "layer" ? "amiriel-renderer__body amiriel-renderer__body--layer" : "amiriel-renderer__body"}
          style={{ fontFamily: AMIRIEL_FONT_STACKS[currentPage?.font || "handwritten"] }}
        >
          {combinedPageText(currentPage)}
        </p>
      )}

      {currentPlacements(currentPage).length ? (
        <span className="amiriel-renderer__media-layer">
          {currentPlacements(currentPage).map((placement) => {
            const media = mediaById(placement.mediaId);
            if (!media) return null;
            return (
              <button
                type="button"
                key={placement.id}
                className="amiriel-renderer__media"
                style={placementStyle(placement)}
                disabled={!interactive}
                tabIndex={interactive ? 0 : -1}
                aria-label={resolvedLabels.viewMedia}
                onClick={(event) => {
                  event.stopPropagation();
                  openMedia(media);
                }}
              >
                {media.type === "image" ? (
                  <img src={media.url} alt={media.objectKey || "media"} draggable={false} />
                ) : (
                  <>
                    <AmirielMediaVideo media={media} showDurationBadge muted preload="metadata" />
                    <span className="amiriel-renderer__video-mark" aria-hidden="true">
                      play
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </span>
      ) : null}
    </>
  );

  return (
    <div className={rootClassName} style={rootStyle}>
      {variant === "paper" ? (
        <div
          ref={paperFrameRef as React.RefObject<HTMLDivElement>}
          className="amiriel-renderer__paper-frame"
          style={{ height: `${activePaperSize.height * paperScale}px` }}
        >
          <article className="amiriel-renderer__paper" style={paperSurfaceStyle}>
            <div className="amiriel-renderer__head">
              <p className="amiriel-renderer__label">{title}</p>
            </div>
            <div className="amiriel-renderer__content">{content}</div>
          </article>
        </div>
      ) : (
        <span ref={paperFrameRef as React.RefObject<HTMLSpanElement>} className="amiriel-renderer__layer-frame">
          <span className="amiriel-renderer__layer-surface" style={paperSurfaceStyle}>
            {content}
          </span>
        </span>
      )}

      {lightbox ? (
        <AmirielMediaLightbox
          open={lightboxOpen}
          media={lightboxMedia}
          closeLabel={resolvedLabels.close}
          imageLabel={resolvedLabels.image}
          videoLabel={resolvedLabels.video}
          onClose={closeMedia}
        />
      ) : null}
    </div>
  );
}
