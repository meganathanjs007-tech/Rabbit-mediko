import { HeartPulse } from 'lucide-react';

export function LoadingScreen({ message = 'Loading Rabbit Mediko...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
        <HeartPulse className="w-7 h-7" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-base font-semibold text-slate-900">Rabbit Mediko</p>
        <p className="text-sm text-slate-500">{message}</p>
      </div>
      <div className="w-36 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full w-1/2 bg-emerald-600 rounded-full animate-[pulse_1.4s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
