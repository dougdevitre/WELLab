import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Stub for future error reporting (e.g., Sentry, LogRocket)
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center"
        >
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-gray-600 mb-6 max-w-md">
            An unexpected error occurred. Please try again or contact support if
            the problem persists.
          </p>
          <button
            onClick={this.handleReset}
            className="px-6 py-2 bg-wellab-600 text-white rounded-lg font-medium hover:bg-wellab-700 focus:outline-none focus:ring-2 focus:ring-wellab-500 focus:ring-offset-2 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
