import { cn } from '@/lib/utils';

export function OuroborosLogo({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4H20V8H8V20H4V4Z" fill="white" fillOpacity="0.9" />
        <path d="M20 4V20H16V8H20Z" fill="white" fillOpacity="0.6" />
        <path d="M20 20H4V16H16V20Z" fill="white" fillOpacity="0.4" />
      </svg>
    </div>
  );
}

