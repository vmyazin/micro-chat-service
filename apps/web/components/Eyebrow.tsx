'use client';

import { motion } from 'framer-motion';
import { type ReactNode } from 'react';

const themes = {
  blue: {
    pill: 'bg-blue-50 border-blue-100',
    text: 'text-blue-600',
    dot: 'bg-blue-600',
  },
  teal: {
    pill: 'bg-teal-50 border-teal-100',
    text: 'text-teal-600',
    dot: 'bg-teal-600',
  },
  slate: {
    pill: 'bg-slate-100 border-slate-200',
    text: 'text-slate-600',
    dot: 'bg-slate-600',
  },
} as const;

type EyebrowColor = keyof typeof themes;

interface EyebrowProps {
  children: ReactNode;
  color?: EyebrowColor;
  icon?: ReactNode;
  pulse?: boolean;
  animate?: 'initial' | 'inView' | false;
  mono?: boolean;
  className?: string;
}

export function Eyebrow({
  children,
  color = 'slate',
  icon,
  pulse,
  animate = 'initial',
  mono,
  className,
}: EyebrowProps) {
  const theme = themes[color];
  const pillClass = `inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${theme.pill}${className ? ` ${className}` : ''}`;
  const textClass = `text-xs font-bold uppercase tracking-widest ${theme.text}${mono ? ' font-mono' : ''}`;

  const content = (
    <>
      {pulse && (
        <span className={`w-2 h-2 ${theme.dot} rounded-full animate-pulse`} />
      )}
      {icon}
      <span className={textClass}>{children}</span>
    </>
  );

  if (animate === 'inView') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className={pillClass}
      >
        {content}
      </motion.div>
    );
  }

  if (animate === 'initial') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={pillClass}
      >
        {content}
      </motion.div>
    );
  }

  return <div className={pillClass}>{content}</div>;
}
