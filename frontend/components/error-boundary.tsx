"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-900 dark:bg-red-950">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
            Đã xảy ra lỗi
          </h2>
          <p className="max-w-md text-center text-sm text-red-600 dark:text-red-400">
            {this.state.error?.message || "Một lỗi không xác định đã xảy ra."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
