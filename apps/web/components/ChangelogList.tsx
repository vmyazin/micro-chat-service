'use client';

import { motion } from 'framer-motion';
import { GhostIcon, ImageIcon, LightningIcon, ShieldIcon, StarFourIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import type { ChangelogCategory } from '@/app/changelog/page';

const iconMap: Record<string, React.ReactNode> = {
  shield: <ShieldIcon className="w-6 h-6" />,
  image: <ImageIcon className="w-6 h-6" />,
  sparkles: <StarFourIcon className="w-6 h-6" />,
  ghost: <GhostIcon className="w-6 h-6" />,
};

const colorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
};

export function ChangelogList({ updates }: { updates: ChangelogCategory[] }) {
  return (
    <>
      <div className="max-w-4xl mx-auto px-6 space-y-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-16"
        >
          {updates.map((update, index) => {
            const colors = colorMap[update.color] ?? colorMap.blue;
            return (
              <section key={update.category} className="relative">
                <div className="flex items-center gap-4 mb-8">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg} ${colors.text}`}
                  >
                    {iconMap[update.icon] ?? iconMap.sparkles}
                  </div>
                  <h2
                    className="text-3xl font-bold text-slate-900"
                    style={{ fontFamily: 'var(--font-bodoni)' }}
                  >
                    {update.category}
                  </h2>
                </div>

                <div className="flex flex-col gap-6">
                  {update.items.map((item, itemIdx) => (
                    <div key={item.title} className="flex gap-6">
                      {/* Timeline rail */}
                      <div className="flex flex-col items-center w-5 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-slate-50 mt-6 shrink-0 z-10" />
                        {itemIdx < update.items.length - 1 && (
                          <div className="w-px flex-1 bg-slate-200 mt-1" />
                        )}
                      </div>

                      {/* Card */}
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: itemIdx * 0.08 + index * 0.15 }}
                        className="flex-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow mb-2"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-2">
                          <h3 className="text-xl font-bold text-slate-900">
                            {item.title}
                          </h3>
                          <span className="text-sm font-mono text-slate-400 shrink-0">
                            {item.date}
                          </span>
                        </div>
                        <p className="text-slate-600 font-light leading-relaxed">
                          {item.description}
                        </p>
                      </motion.div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </motion.div>
      </div>

      <div className="max-w-4xl mx-auto px-6 mt-20 text-center">
        <div className="bg-linear-to-br from-blue-50 to-slate-50 rounded-3xl p-10 border border-blue-100 inline-block">
          <LightningIcon className="w-10 h-10 text-blue-600 mx-auto mb-4" />
          <h3
            className="text-2xl font-bold text-slate-900 mb-2"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            Ready to experience these updates?
          </h3>
          <p className="text-slate-600 font-light mb-6 hidden md:block">
            Create a private group to enjoy secure, fast messaging right now.
          </p>
          <Link
            href="/chat"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
          >
            Chat Securely Now
          </Link>
        </div>
      </div>
    </>
  );
}
