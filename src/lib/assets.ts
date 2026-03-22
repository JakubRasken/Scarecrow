import { invoke } from "@tauri-apps/api/core";
import type { StoragePaths } from "./types";

let storagePromise: Promise<StoragePaths> | null = null;
const byteCache = new Map<string, Promise<Uint8Array>>();
const objectUrlCache = new Map<string, Promise<string>>();

export const getStoragePaths = () => {
  if (!storagePromise) {
    storagePromise = invoke<StoragePaths>("get_storage_paths");
  }
  return storagePromise;
};

const getMimeType = (path: string) => {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
};

export const readAssetBytes = async (relativePath: string) => {
  const cached = byteCache.get(relativePath);
  if (cached) {
    return cached;
  }

  const promise = invoke<number[]>("read_asset_bytes", { relativePath }).then(
    (bytes) => new Uint8Array(bytes)
  );
  byteCache.set(relativePath, promise);

  try {
    return await promise;
  } catch (error) {
    byteCache.delete(relativePath);
    throw error;
  }
};

export const createAssetObjectUrl = async (relativePath: string) => {
  const cached = objectUrlCache.get(relativePath);
  if (cached) {
    return cached;
  }

  const promise = readAssetBytes(relativePath).then((bytes) =>
    URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], { type: getMimeType(relativePath) })
    )
  );
  objectUrlCache.set(relativePath, promise);

  try {
    return await promise;
  } catch (error) {
    objectUrlCache.delete(relativePath);
    throw error;
  }
};

export const resolveAssetUrl = async (relativePath: string) => createAssetObjectUrl(relativePath);
