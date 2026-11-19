import { Loader2 } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export function LoadingScreen({ message = 'Loading Rabbit Mediko...' }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen w-full bg-[#F8FAFC] flex flex-col items-center justify-center p-6 gap-5"
    >
      <div className="relative flex items-center justify-center">
        <BrandLogo size="xl" className="shadow-lg shadow-slate-900/15" />
        <span className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
        </span>
      </div>

      <div className="text-center space-y-1 max-w-xs">
        <p className="text-base font-bold tracking-tight text-slate-900">Rabbit Mediko</p>
        <p className="text-sm text-slate-500">{message}</p>
      </div>

      <div className="w-40 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full w-1/2 bg-emerald-600 rounded-full animate-pulse" />
      </div>
    </div>
  );
}
