import { useEffect } from "react";
import type { AmirielMedia } from "@amiriel/core";
import { AmirielMediaVideo } from "./AmirielMediaVideo";

export interface AmirielMediaLightboxProps {
  open: boolean;
  media: AmirielMedia | null;
  closeLabel?: string;
  imageLabel?: string;
  videoLabel?: string;
  onClose: () => void;
}

export function AmirielMediaLightbox({
  open,
  media,
  closeLabel = "Close",
  imageLabel = "Image",
  videoLabel = "Video",
  onClose,
}: AmirielMediaLightboxProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open || !media) return null;

  return (
    <div className="amiriel-lightbox" role="dialog" aria-modal="true" aria-label={media.type === "image" ? imageLabel : videoLabel}>
      <button type="button" className="amiriel-lightbox__backdrop" aria-label={closeLabel} onClick={onClose} />
      <div className="amiriel-lightbox__frame">
        <button type="button" className="amiriel-lightbox__close" aria-label={closeLabel} onClick={onClose}>
          x
        </button>
        {media.type === "image" ? (
          <img src={media.url} alt={media.objectKey || imageLabel} />
        ) : (
          <AmirielMediaVideo media={media} controls autoPlay />
        )}
      </div>
    </div>
  );
}
