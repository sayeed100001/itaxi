import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store';
import { getTranslations } from '../services/i18n';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  declare state: ErrorBoundaryState;
  declare props: React.PropsWithChildren<{}>;

  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const t = getTranslations(useAppStore.getState().language);
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {t.errors.boundary_title}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {t.errors.boundary_desc}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t.errors.refresh_page}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
