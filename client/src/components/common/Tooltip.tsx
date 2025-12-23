import { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ children, text, position = 'top' }: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative group/tooltip inline-flex">
      {children}
      <div
        className={`
          absolute z-50 px-2 py-1 text-xs font-medium
          bg-surface-600 text-white rounded shadow-lg
          opacity-0 group-hover/tooltip:opacity-100
          transition-opacity duration-200 delay-300
          pointer-events-none whitespace-nowrap
          ${positionClasses[position]}
        `}
      >
        {text}
      </div>
    </div>
  );
}
