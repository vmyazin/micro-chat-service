import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for merging tailwind classes safely
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
  title: string;
  description?: string;
}

export function SidebarItem({
  isActive,
  title,
  description,
  className,
  ...props
}: SidebarItemProps) {
  return (
    <button
      className={cn(
        'group-list-item w-full text-left p-4 border-base transition-colors focus:outline-none focus:ring-2 focus:ring-(--accent)',
        {
          'bg-(--accent) text-white border-(--accent-hover)': isActive,
          'bg-(--surface-elevated) enabled:hover:bg-(--surface-muted)': !isActive,
        },
        className
      )}
      {...props}
    >
      <div className="font-semibold truncate">
        {title}
      </div>
      {description && (
        <div
          className={cn('text-xs mt-1', {
            'text-white/70': isActive,
            'text-(--text-secondary)': !isActive,
          })}
        >
          {description}
        </div>
      )}
    </button>
  );
}
