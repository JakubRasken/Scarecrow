import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Scarecrow render failed", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal-overlay">
          <div className="fatal-card">
            <div className="modal-title">Scarecrow failed to load</div>
            <div className="fatal-text">{this.state.error.stack ?? this.state.error.message}</div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
