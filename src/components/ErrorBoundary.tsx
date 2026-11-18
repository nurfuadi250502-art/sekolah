import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.error) {
        readable = `${parsed.error} (Operasi: ${parsed.operationType || 'unknown'}, Path: ${parsed.path || '-'})`;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Portal ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#091322] p-6">
          <div className="max-w-lg w-full bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-8">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-bold">Terjadi Gangguan Sistem</h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Aplikasi mendeteksi kesalahan saat memproses permintaan data atau hak akses.
            </p>
            <div className="bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs font-mono-tabular text-slate-700 dark:text-slate-300 break-words mb-6">
              {this.state.message}
            </div>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#173A66] text-white text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
