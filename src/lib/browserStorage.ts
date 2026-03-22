import type { Block, Page, Workspace } from "./types";

const DB_KEY = "scarecrow-web-db-v1";
const ASSETS_KEY = "scarecrow-web-assets-v1";

interface BrowserSnapshot {
  workspaces: Workspace[];
  pages: Page[];
  blocks: Record<string, Block>;
}

const defaultSnapshot = (): BrowserSnapshot => ({
  workspaces: [],
  pages: [],
  blocks: {}
});

const canUseStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

export const readBrowserSnapshot = (): BrowserSnapshot => {
  if (!canUseStorage()) {
    return defaultSnapshot();
  }

  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      return defaultSnapshot();
    }
    return JSON.parse(raw) as BrowserSnapshot;
  } catch {
    return defaultSnapshot();
  }
};

export const writeBrowserSnapshot = (snapshot: BrowserSnapshot) => {
  if (!canUseStorage()) {
    return;
  }
  localStorage.setItem(DB_KEY, JSON.stringify(snapshot));
};

export const readBrowserAssets = (): Record<string, string> => {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = localStorage.getItem(ASSETS_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
};

export const writeBrowserAssets = (assets: Record<string, string>) => {
  if (!canUseStorage()) {
    return;
  }
  localStorage.setItem(ASSETS_KEY, JSON.stringify(assets));
};

export const readBrowserAsset = (path: string) => readBrowserAssets()[path] ?? null;

export const writeBrowserAsset = (path: string, dataUrl: string) => {
  const assets = readBrowserAssets();
  assets[path] = dataUrl;
  writeBrowserAssets(assets);
};
