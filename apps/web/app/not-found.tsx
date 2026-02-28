'use client';

import { GhostIcon } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Eyebrow } from '@/components/Eyebrow';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      <SiteHeader />

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-2xl mx-auto">

          {/* Floating ghost */}
          <motion.div
            className="flex justify-center mb-10"
            animate={{ y: [0, -16, 0], opacity: [0.35, 0.6, 0.35] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <GhostIcon className="w-28 h-28 text-slate-300" weight="thin" />
          </motion.div>

          {/* Error badge */}
          <Eyebrow mono className="mb-8">Error 404</Eyebrow>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-7xl font-semibold italic text-slate-900 leading-tight mb-6"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            This Page Has Gone Ghost.
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-slate-400 font-light text-lg leading-relaxed mb-12"
          >
            Deleted from our servers. Zero trace. Just how we like it.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/chat"
              className="w-full sm:w-auto bg-blue-600 text-white px-10 py-4 rounded-full font-bold text-base hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-95 text-center"
            >
              Chat Securely Now
            </Link>
            <Link
              href="/"
              className="w-full sm:w-auto bg-white text-slate-700 px-10 py-4 rounded-full font-bold text-base border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all active:scale-95 text-center"
            >
              Learn about MicroChat
            </Link>
          </motion.div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
