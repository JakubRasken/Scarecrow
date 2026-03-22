import { memo, useState } from "react";
import type { VideoBlock as VideoBlockType } from "../../lib/types";
import { getEmbedUrl } from "../../lib/utils";
import { PlayIcon } from "../common/Icons";

const VideoBlock = memo(({ block }: { block: VideoBlockType }) => {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="video-block">
      {!playing ? (
        <div className="video-preview">
          {block.content.thumbnailUrl ? (
            <img src={block.content.thumbnailUrl} alt={block.content.url} />
          ) : (
            <div className="video-loading" />
          )}
          <div className="play-overlay">
            <button
              type="button"
              className="play-button"
              data-block-interactive="true"
              onClick={() => {
                setError("");
                setLoading(true);
                setPlaying(true);
              }}
            >
              <PlayIcon />
            </button>
          </div>
        </div>
      ) : (
        <div className="video-stage">
          {loading ? <div className="video-loading video-loading-overlay" /> : null}
          {error ? <div className="media-error">{error}</div> : null}
          <iframe
            className="video-frame"
            src={getEmbedUrl(block.content)}
            title={`${block.content.platform} video`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError("This video embed could not be loaded.");
            }}
          />
        </div>
      )}
    </div>
  );
});

export default VideoBlock;
