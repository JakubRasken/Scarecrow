import ReactDOM from "react-dom/client";
import "./styles/global.css";
import ErrorBoundary from "./components/common/ErrorBoundary";

const renderBootstrapError = (message: string) => {
  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  root.innerHTML = `
    <div class="fatal-overlay">
      <div class="fatal-card">
        <div class="modal-title">Scarecrow failed to start</div>
        <div class="fatal-text">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      </div>
    </div>
  `;
};

void (async () => {
  try {
    const [{ pdfjs }, React, { default: App }] = await Promise.all([
      import("react-pdf"),
      import("react"),
      import("./App")
    ]);

    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error("Scarecrow bootstrap failed", error);
    renderBootstrapError(message);
  }
})();
