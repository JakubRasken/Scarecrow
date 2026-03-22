export const isTauriRuntime = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const closeCurrentWindow = async () => {
  if (!isTauriRuntime()) {
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
};

export const listenAppEvent = async <T>(
  eventName: string,
  handler: (event: { payload: T }) => void
) => {
  if (!isTauriRuntime()) {
    return () => {};
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<T>(eventName, handler);
};

export const pickImportSources = async (
  accept: string,
  multiple = false
): Promise<Array<string | File>> => {
  if (isTauriRuntime()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      multiple,
      filters: [
        {
          name: "Files",
          extensions: accept
            .split(",")
            .map((item) => item.trim().replace(".", ""))
            .filter(Boolean)
        }
      ]
    });

    if (!result) {
      return [];
    }
    return Array.isArray(result) ? result : [result];
  }

  return new Promise<Array<string | File>>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => {
      resolve(Array.from(input.files ?? []));
    };
    input.click();
  });
};
