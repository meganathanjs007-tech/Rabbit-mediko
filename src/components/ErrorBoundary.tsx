import React from 'react';
import { Home, RotateCcw } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'An unexpected interruption occurred.' };
  }

  render() {
    if (this.state.hasError) {
      let displayMsg = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string };
        if (parsed && parsed.error) {
          displayMsg = parsed.error;
        }
      } catch {
        // Use plain message
      }

      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5 text-center">
            <div className="flex justify-center">
              <BrandLogo size="lg" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-lg font-bold text-slate-900">Something interrupted Rabbit Mediko</h1>
              <p className="text-sm text-slate-600 leading-relaxed break-words">{displayMsg}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors min-h-[44px] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload App</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/';
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors min-h-[44px] cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Go Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
