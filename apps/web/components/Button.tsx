import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for merging tailwind classes safely
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'colorful' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          {
            'btn-base': variant === 'primary',
            'bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 enabled:hover:from-pink-600 enabled:hover:via-purple-600 enabled:hover:to-indigo-600 text-white shadow-md enabled:hover:shadow-lg enabled:hover:-translate-y-0.5 transition-all font-bold tracking-wide rounded-md px-4 py-2': variant === 'colorful',
            'bg-red-600 text-white enabled:hover:bg-red-700 rounded-md': variant === 'danger',
            'bg-green-600 text-white enabled:hover:bg-green-700 rounded-md': variant === 'success',
            'bg-orange-600 text-white enabled:hover:bg-orange-700 rounded-md': variant === 'warning',
            'bg-gray-100 dark:bg-gray-800 enabled:hover:bg-gray-200 dark:enabled:hover:bg-gray-700 text-foreground rounded-md': variant === 'secondary',
            'border-base enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-800 bg-transparent rounded-md': variant === 'outline',
            'enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-800 bg-transparent rounded-md': variant === 'ghost',
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2': size === 'md' && variant !== 'primary',
            'px-6 py-3 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
