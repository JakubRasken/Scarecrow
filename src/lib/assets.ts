import type { StoragePaths } from "./types";
import { readBrowserAsset } from "./browserStorage";
import { isTauriRuntime } from "./platform";

let storagePromise: Promise<StoragePaths> | null = null;
const byteCache = new Map<string, Promise<Uint8Array>>();
const objectUrlCache = new Map<string, Promise<string>>();

const invokeTauri = async <T>(command: string, args?: Record<string, unknown>) => {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
};

export const getStoragePaths = () => {
  if (!storagePromise) {
    storagePromise = isTauriRuntime()
      ? invokeTauri<StoragePaths>("get_storage_paths")
      : Promise.resolve({
          baseDir: "browser://local-storage",
          dbPath: "browser://local-storage/db",
          assetsDir: "browser://local-storage/assets"
        });
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

const dataUrlToBytes = (dataUrl: string) => {
  const [, base64 = ""] = dataUrl.split(",", 2);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const readAssetBytes = async (relativePath: string) => {
  const cached = byteCache.get(relativePath);
  if (cached) {
    return cached;
  }

  const promise = isTauriRuntime()
    ? invokeTauri<number[]>("read_asset_bytes", { relativePath }).then(
        (bytes) => new Uint8Array(bytes)
      )
    : Promise.resolve().then(() => {
        const dataUrl = readBrowserAsset(relativePath);
        if (!dataUrl) {
          throw new Error("Asset not found in browser storage.");
        }
        return dataUrlToBytes(dataUrl);
      });

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

  const promise = isTauriRuntime()
    ? readAssetBytes(relativePath).then((bytes) =>
        URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: getMimeType(relativePath) })
        )
      )
    : Promise.resolve().then(() => {
        const dataUrl = readBrowserAsset(relativePath);
        if (!dataUrl) {
          throw new Error("Asset not found in browser storage.");
        }
        return dataUrl;
      });

  objectUrlCache.set(relativePath, promise);

  try {
    return await promise;
  } catch (error) {
    objectUrlCache.delete(relativePath);
    throw error;
  }
};

export const resolveAssetUrl = async (relativePath: string) => createAssetObjectUrl(relativePath);
