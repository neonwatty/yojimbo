import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The icon to display */
  children: ReactNode;
  /** Visual size variant - all variants meet 44px minimum touch target */
  variant?: 'default' | 'compact';
  /** Color scheme */
  color?: 'default' | 'accent' | 'danger' | 'frost';
  /** Whether the button is in an active/selected state */
  active?: boolean;
}

/**
 * Icon button with proper touch target sizing (minimum 44x44px).
 * Use this for all icon-only buttons to ensure mobile accessibility.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, variant = 'default', color = 'default', active = false, className = '', disabled, ...props }, ref) => {
    // Base classes - ensure minimum 44x44px touch target
    const baseClasses = 'inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed';

    // Size classes - both variants meet 44px minimum, but visual appearance differs
    const sizeClasses = variant === 'compact'
      ? 'min-w-11 min-h-11 p-2' // 44px with smaller visual padding
      : 'min-w-11 min-h-11 p-2.5'; // 44px with comfortable padding

    // Color classes
    const colorClasses = {
      default: active
        ? 'bg-surface-600 text-theme-primary'
        : 'text-theme-muted hover:text-theme-primary hover:bg-surface-700',
      accent: active
        ? 'bg-accent/20 text-accent'
        : 'text-theme-muted hover:text-accent hover:bg-surface-700',
      danger: 'text-theme-muted hover:text-red-400 hover:bg-red-500/10',
      frost: active
        ? 'bg-frost-4/20 text-frost-3'
        : 'text-frost-3/70 hover:text-frost-3 hover:bg-frost-4/10',
    };

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${sizeClasses} ${colorClasses[color]} ${className}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
