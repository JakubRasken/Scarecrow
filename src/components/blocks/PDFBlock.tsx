import { memo, useEffect, useMemo, useState } from "react";
import { Document, Page } from "react-pdf";
import type { PdfBlock as PdfBlockType } from "../../lib/types";
import { useScarecrowStore } from "../../store";
import { openAssetInOs } from "../../lib/db";
import { readAssetBytes } from "../../lib/assets";
import { A4_ASPECT_RATIO } from "../../lib/utils";

interface PDFBlockProps {
  block: PdfBlockType;
}

const PDFBlock = memo(({ block }: PDFBlockProps) => {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const updateBlock = useScarecrowStore((state) => state.updateBlock);

  const uiScale = useMemo(
    () => Math.min(3.2, Math.max(1, Math.min(block.width / 240, block.height / 320))),
    [block.height, block.width]
  );
  const controlHeight = 44 * uiScale;
  const framePadding = 12 * Math.min(uiScale, 1.6);
  const availableWidth = Math.max(120, block.width - framePadding * 2 - 4);
  const availableHeight = Math.max(
    120,
    block.height - controlHeight - framePadding * 2 - 4
  );
  const fitWidth = useMemo(() => {
    const ratio = block.content.aspectRatio ?? A4_ASPECT_RATIO;
    return Math.max(120, Math.floor(Math.min(availableWidth, availableHeight * ratio) - 2));
  }, [availableHeight, availableWidth, block.content.aspectRatio]);

  const documentFile = useMemo(
    () => (pdfData ? { data: pdfData } : null),
    [pdfData]
  );

  useEffect(() => {
    let active = true;
    setPdfData(null);
    setError("");

    void (async () => {
      try {
        const bytes = await readAssetBytes(block.content.assetPath);
        if (!active) {
          return;
        }
        setPdfData(bytes);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : "This PDF could not be opened."
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [block.content.assetPath]);

  return (
    <div className="pdf-block" style={{ ["--pdf-ui-scale" as string]: String(uiScale) }}>
      <button
        type="button"
        className="hover-action"
        data-block-interactive="true"
        onClick={() => {
          if (block.content.assetPath) {
            void openAssetInOs(block.content.assetPath);
          }
        }}
      >
        Open
      </button>
      <div className="pdf-frame">
        {error ? (
          <div className="media-error">{error}</div>
        ) : documentFile ? (
          <Document
            file={documentFile}
            loading={<div className="video-loading pdf-loading-state" />}
            noData={<div className="media-empty">No PDF selected.</div>}
            error={<div className="media-error">This PDF could not be rendered.</div>}
            onLoadError={(loadError) =>
              setError(loadError.message || "This PDF could not be rendered.")
            }
            onSourceError={(sourceError) =>
              setError(sourceError.message || "This PDF source could not be read.")
            }
            onLoadSuccess={({ numPages }) => {
              if (numPages !== block.content.totalPages) {
                updateBlock(
                  block.id,
                  {
                    content: {
                      ...block.content,
                      totalPages: numPages,
                      currentPage: Math.min(block.content.currentPage, numPages)
                    }
                  },
                  { skipHistory: true }
                );
              }
            }}
          >
            <Page
              pageNumber={block.content.currentPage}
              width={fitWidth}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              loading={<div className="video-loading pdf-loading-state" />}
              error={<div className="media-error">Page preview failed to load.</div>}
              onLoadSuccess={(page) => {
                const viewport = page.getViewport({ scale: 1 });
                const aspectRatio =
                  viewport.width && viewport.height
                    ? viewport.width / viewport.height
                    : A4_ASPECT_RATIO;

                const patch: Partial<PdfBlockType> = {};
                const contentPatch =
                  Math.abs((block.content.aspectRatio ?? A4_ASPECT_RATIO) - aspectRatio) > 0.001
                    ? {
                        ...block.content,
                        aspectRatio
                      }
                    : null;

                if (contentPatch) {
                  patch.content = contentPatch;
                }

                if (Object.keys(patch).length) {
                  updateBlock(block.id, patch, { skipHistory: true });
                }
              }}
            />
          </Document>
        ) : (
          <div className="video-loading pdf-loading-state" />
        )}
      </div>
      <div className="pdf-controls" data-block-interactive="true">
        <button
          type="button"
          className="pill-button"
          onClick={() =>
            updateBlock(block.id, {
              content: {
                ...block.content,
                currentPage: Math.max(1, block.content.currentPage - 1)
              }
            })
          }
        >
          Prev
        </button>
        <button
          type="button"
          className="pill-button"
          onClick={() =>
            updateBlock(block.id, {
              content: {
                ...block.content,
                zoom: Math.max(0.6, Number((block.content.zoom - 0.1).toFixed(2)))
              }
            })
          }
        >
          -
        </button>
        <span className="meta-text">
          {block.content.currentPage} / {block.content.totalPages}
        </span>
        <button
          type="button"
          className="pill-button"
          onClick={() =>
            updateBlock(block.id, {
              content: {
                ...block.content,
                zoom: Math.min(2.6, Number((block.content.zoom + 0.1).toFixed(2)))
              }
            })
          }
        >
          +
        </button>
        <button
          type="button"
          className="pill-button"
          onClick={() =>
            updateBlock(block.id, {
              content: {
                ...block.content,
                currentPage: Math.min(
                  block.content.totalPages,
                  block.content.currentPage + 1
                )
              }
            })
          }
        >
          Next
        </button>
      </div>
    </div>
  );
});

export default PDFBlock;
