import { memo, useEffect, useState } from "react";
import type { ImageBlock as ImageBlockType } from "../../lib/types";
import { createAssetObjectUrl } from "../../lib/assets";
import { ExternalIcon } from "../common/Icons";
import { useScarecrowStore } from "../../store";

const ImageBlock = memo(({ block }: { block: ImageBlockType }) => {
  const [assetUrl, setAssetUrl] = useState("");
  const [error, setError] = useState("");
  const setImageViewer = useScarecrowStore((state) => state.setImageViewer);

  useEffect(() => {
    let active = true;
    let currentUrl = "";
    setAssetUrl("");
    setError("");

    void (async () => {
      try {
        const url = await createAssetObjectUrl(block.content.assetPath);
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        currentUrl = url;
        setAssetUrl(url);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : "This image could not be opened."
        );
      }
    })();

    return () => {
      active = false;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [block.content.assetPath]);

  return (
    <div className="image-block">
      {error ? (
        <div className="media-error">{error}</div>
      ) : assetUrl ? (
        <img
          className="asset-preview"
          src={assetUrl}
          alt={block.content.originalName}
          draggable={false}
        />
      ) : (
        <div className="video-loading" />
      )}
      <button
        type="button"
        className="hover-action"
        data-block-interactive="true"
        onClick={() => {
          if (block.content.assetPath) {
            setImageViewer({
              open: true,
              assetPath: block.content.assetPath,
              name: block.content.originalName
            });
          }
        }}
        title="Open in viewer"
      >
        <ExternalIcon />
      </button>
    </div>
  );
});

export default ImageBlock;
