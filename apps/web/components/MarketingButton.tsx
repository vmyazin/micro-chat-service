import Link from 'next/link';
import { type ReactNode, type ButtonHTMLAttributes } from 'react';

const variants = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-600/20',
  secondary:
    'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50',
} as const;

const sizes = {
  md: 'px-10 py-4 text-base',
  lg: 'px-12 py-5 text-xl shadow-blue-600/30',
} as const;

type CommonProps = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  children: ReactNode;
  className?: string;
};

type AsLink = CommonProps & {
  href: string;
  onClick?: never;
  type?: never;
};

type AsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: never;
  };

export type MarketingButtonProps = AsLink | AsButton;

export function MarketingButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: MarketingButtonProps) {
  const classes = [
    'inline-flex items-center justify-center rounded-full font-bold transition-all active:scale-95 text-center cursor-pointer',
    variants[variant],
    sizes[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if ('href' in rest && rest.href) {
    return (
      <Link href={rest.href} className={classes}>
        {children}
      </Link>
    );
  }

  const { href: _, ...buttonProps } = rest as AsButton;
  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
