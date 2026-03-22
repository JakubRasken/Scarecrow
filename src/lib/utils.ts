import { v4 as uuidv4 } from "uuid";
import type {
  Block,
  BlockType,
  ImageBlockContent,
  NoteBlockContent,
  PdfBlockContent,
  VideoBlockContent
} from "./types";

export const NOTE_COLORS = [
  "#1A1A20",
  "#1A1A2E",
  "#1A2E1A",
  "#2E1A1A",
  "#2A1A2E",
  "#2E2A1A"
] as const;

export const A4_ASPECT_RATIO = 210 / 297;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const now = () => Date.now();

export const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export const getDefaultBlockSize = (
  type: BlockType
): { width: number; height: number } => {
  switch (type) {
    case "note":
      return { width: 240, height: 180 };
    case "image":
      return { width: 300, height: 220 };
    case "pdf":
      return { width: 340, height: 480 };
    case "video":
      return { width: 480, height: 290 };
    default:
      return { width: 240, height: 180 };
  }
};

export const getMinBlockSize = (
  type: BlockType
): { width: number; height: number } => {
  switch (type) {
    case "note":
      return { width: 160, height: 80 };
    case "image":
      return { width: 80, height: 60 };
    case "pdf":
      return { width: 240, height: 300 };
    case "video":
      return { width: 280, height: 160 };
    default:
      return { width: 160, height: 80 };
  }
};

export const getDefaultContent = (
  type: BlockType
): NoteBlockContent | ImageBlockContent | PdfBlockContent | VideoBlockContent => {
  switch (type) {
    case "note":
      return {
        html: "<p>Untitled note</p>",
        bgColor: NOTE_COLORS[0]
      };
    case "image":
      return {
        assetPath: "",
        originalName: "",
        aspectRatio: 1.5
      };
    case "pdf":
      return {
        assetPath: "",
        currentPage: 1,
        totalPages: 1,
        zoom: 1,
        aspectRatio: A4_ASPECT_RATIO
      };
    case "video":
      return {
        url: "",
        platform: "youtube",
        videoId: "",
        thumbnailUrl: ""
      };
    default:
      return {
        html: "<p>Untitled note</p>",
        bgColor: NOTE_COLORS[0]
      };
  }
};

export const createBlock = <T extends Block["type"]>(
  type: T,
  pageId: string,
  x: number,
  y: number,
  zIndex: number,
  content: Extract<Block, { type: T }>["content"]
): Extract<Block, { type: T }> => {
  const { width, height } = getDefaultBlockSize(type);
  const timestamp = now();

  return {
    id: uuidv4(),
    pageId,
    type,
    x,
    y,
    width,
    height,
    zIndex,
    content,
    createdAt: timestamp,
    updatedAt: timestamp
  } as Extract<Block, { type: T }>;
};

export const blockIntersects = (
  block: Block,
  bounds: { left: number; top: number; right: number; bottom: number }
) =>
  block.x < bounds.right &&
  block.x + block.width > bounds.left &&
  block.y < bounds.bottom &&
  block.y + block.height > bounds.top;

export const cloneSnapshot = <T>(value: T): T => structuredClone(value);

export const nextZIndex = (blocks: Block[]) =>
  blocks.reduce((max, block) => Math.max(max, block.zIndex), 0) + 1;

export const parseBlockContent = (type: BlockType, content: string): Block["content"] => {
  const parsed = JSON.parse(content);
  if (type === "note") {
    return {
      html: parsed.html ?? "<p>Untitled note</p>",
      bgColor: parsed.bgColor ?? NOTE_COLORS[0]
    };
  }
  if (type === "image") {
    return {
      assetPath: parsed.assetPath ?? "",
      originalName: parsed.originalName ?? "",
      aspectRatio: parsed.aspectRatio ?? 1.5
    };
  }
  if (type === "pdf") {
    return {
      assetPath: parsed.assetPath ?? "",
      currentPage: parsed.currentPage ?? 1,
      totalPages: parsed.totalPages ?? 1,
      zoom: parsed.zoom ?? 1,
      aspectRatio: parsed.aspectRatio ?? A4_ASPECT_RATIO
    };
  }
  return {
    url: parsed.url ?? "",
    platform: parsed.platform ?? "youtube",
    videoId: parsed.videoId ?? "",
    thumbnailUrl: parsed.thumbnailUrl ?? ""
  };
};

export const serializeBlockContent = (content: Block["content"]) =>
  JSON.stringify(content);

export const isImageFile = (path: string) =>
  /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(path);

export const isPdfFile = (path: string) => /\.pdf$/i.test(path);

export const screenToWorld = (
  point: { x: number; y: number },
  rect: DOMRect,
  viewport: { x: number; y: number; zoom: number }
) => ({
  x: (point.x - rect.left - viewport.x) / viewport.zoom,
  y: (point.y - rect.top - viewport.y) / viewport.zoom
});

export interface ParsedVideo {
  url: string;
  platform: "youtube" | "tiktok";
  videoId: string;
  thumbnailUrl: string;
}

export const parseVideoUrl = (input: string): ParsedVideo | null => {
  try {
    const url = new URL(input.trim());

    if (url.hostname.includes("youtube.com")) {
      const videoId = url.searchParams.get("v");
      if (!videoId) {
        return null;
      }
      return {
        url: url.toString(),
        platform: "youtube",
        videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      };
    }

    if (url.hostname.includes("youtu.be")) {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      if (!videoId) {
        return null;
      }
      return {
        url: url.toString(),
        platform: "youtube",
        videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      };
    }

    if (url.hostname.includes("tiktok.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const videoMarker = parts.findIndex((part) => part === "video");
      const videoId = videoMarker > -1 ? parts[videoMarker + 1] : "";
      if (!videoId) {
        return null;
      }
      return {
        url: url.toString(),
        platform: "tiktok",
        videoId,
        thumbnailUrl: ""
      };
    }

    return null;
  } catch {
    return null;
  }
};

export const getEmbedUrl = (content: VideoBlockContent) =>
  content.platform === "youtube"
    ? `https://www.youtube.com/embed/${content.videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`
    : `https://www.tiktok.com/embed/v2/${content.videoId}?autoplay=1`;

export const pluralize = (count: number, singular: string, plural?: string) =>
  `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
