'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/dashboard';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[oklch(0.145_0_0)] p-4">
          <div className="max-w-md w-full bg-[oklch(0.205_0_0)] border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-red-400" size={32} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              エラーが発生しました
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              予期しないエラーが発生しました。再試行するか、ダッシュボードに戻ってください。
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="text-xs text-red-400 bg-red-500/10 rounded-lg p-3 mb-4 text-left overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              >
                <RefreshCw size={16} />
                再試行
              </button>
              <button
                onClick={this.handleHome}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-black rounded-xl hover:bg-gray-200 transition-colors"
              >
                <Home size={16} />
                ダッシュボード
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
