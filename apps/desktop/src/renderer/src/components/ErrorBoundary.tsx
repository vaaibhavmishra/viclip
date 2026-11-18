import { AlertCircle, RefreshCw } from "lucide-react";
import React, { type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Renderer ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center select-none bg-background text-foreground">
          <div className="p-3 mb-4 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-xs text-muted-foreground max-w-sm mb-6">
            {this.state.error?.message ||
              "An unexpected error occurred in the application interface."}
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </Button>
            <Button
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              Reload Interface
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
