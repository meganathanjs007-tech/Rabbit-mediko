import { useState } from 'react';
import { HeartPulse } from 'lucide-react';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps['size']>, string> = {
  xs: 'w-7 h-7 rounded-lg',
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-9 h-9 rounded-xl',
  lg: 'w-14 h-14 rounded-2xl',
  xl: 'w-20 h-20 rounded-2xl',
};

const ICON_SIZES: Record<NonNullable<BrandLogoProps['size']>, string> = {
  xs: 'w-4 h-4',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-9 h-9',
};

export function BrandLogo({ size = 'md', className = '' }: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`${SIZE_CLASSES[size]} bg-[#0B0B11] overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-slate-900/10 ${className}`}
    >
      {imgError ? (
        <HeartPulse className={`${ICON_SIZES[size]} text-emerald-400`} />
      ) : (
        <img
          src="/assets/aistudio/1795024642701_18b5ae14.png"
          alt="Rabbit Mediko logo"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center"
        />
      )}
    </div>
  );
}
