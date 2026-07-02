import type { VideoHTMLAttributes } from "react";
import { formatVideoDuration, type AmirielMedia } from "amiriel";

export interface AmirielMediaVideoProps extends Omit<VideoHTMLAttributes<HTMLVideoElement>, "src" | "poster"> {
  media: AmirielMedia;
  showDurationBadge?: boolean;
}

export function AmirielMediaVideo({
  media,
  showDurationBadge = false,
  className,
  ...videoProps
}: AmirielMediaVideoProps) {
  const duration = formatVideoDuration(media.duration ?? 0);

  return (
    <span className={["amiriel-media-video", className].filter(Boolean).join(" ")}>
      <video
        {...videoProps}
        src={media.url}
        poster={media.thumbnailUrl}
      />
      {showDurationBadge && duration ? (
        <span className="amiriel-media-video__duration">{duration}</span>
      ) : null}
    </span>
  );
}
