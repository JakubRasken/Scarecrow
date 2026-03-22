import { invoke } from "@tauri-apps/api/core";
import type { StoragePaths } from "./types";

let storagePromise: Promise<StoragePaths> | null = null;

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

export const readAssetBytes = async (relativePath: string) =>
  invoke<number[]>("read_asset_bytes", { relativePath }).then(
    (bytes) => new Uint8Array(bytes)
  );

export const createAssetObjectUrl = async (relativePath: string) => {
  const bytes = await readAssetBytes(relativePath);
  return URL.createObjectURL(new Blob([bytes], { type: getMimeType(relativePath) }));
};

export const resolveAssetUrl = async (relativePath: string) => createAssetObjectUrl(relativePath);
