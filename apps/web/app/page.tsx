// apps/web/app/page.tsx
'use client';

import {
  CaretRight,
  Check,
  Lock,
  Shield,
  Trash,
  Warning,
} from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export default function Home() {
  const features = [
    {
      icon: <Lock className="w-6 h-6" />,
      title: 'End-to-End Encrypted',
      description:
        'Messages are encrypted on your device using the MLS protocol. Our servers only see encrypted blobs—we cannot read your content.',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Forward Secrecy',
      description:
        "Compromise of current keys doesn't expose past messages. Each message epoch uses fresh key material derived via HKDF.",
    },
    {
      icon: <Trash className="w-6 h-6" />,
      title: 'Server-Side Crypto-Erasure',
      description:
        'When a group is deleted, we destroy all key material. Stored ciphertext becomes permanently unrecoverable.',
    },
  ];

  const promises = [
    "Content stays encrypted—we can't read it",
    'Forward secrecy protects past messages',
    'Post-compromise security via key rotation',
    'Crypto-erasure on group deletion',
  ];

  const limitations = [
    'Metadata privacy (we see group membership, timing)',
    'Protection if your device is compromised',
    'Invisibility to network observers',
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased overflow-x-hidden selection:bg-blue-600 selection:text-white">
      <SiteHeader />

      <main>
        {/* Hero Section */}
        <section className="pt-40 pb-24 px-6 relative overflow-hidden">
          <div className="max-w-7xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-8"
            >
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                Built on MLS Protocol
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-8xl leading-none mb-8 font-semibold italic text-slate-900"
              style={{ fontFamily: 'Bodoni Moda, serif' }}
            >
              Private Group Messaging, <br />
              <span className="text-gray-400">Built on Standards.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-2xl mx-auto text-lg md:text-xl text-gray-500 font-light leading-relaxed mb-12"
            >
              End-to-end encrypted conversations using MLS (RFC 9420). We can't
              read your messages. When you delete a group, we destroy the keys.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                href="/chat"
                className="w-full sm:w-auto bg-blue-600 text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 cursor-pointer active:scale-95 text-center"
              >
                Create Private Group
              </Link>
              <Button
                variant="ghost"
                type="button"
                className="w-full sm:w-auto bg-white text-[#1E293B] border border-gray-200 font-bold text-lg hover:bg-gray-50 transition-all cursor-pointer"
              >
                How it works
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="protocol"
          className="py-24 bg-white border-y border-gray-100 px-6"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2
                className="text-4xl md:text-5xl mb-6 font-semibold italic text-slate-900"
                style={{ fontFamily: 'Bodoni Moda, serif' }}
              >
                How We Protect Your Messages.
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto font-light leading-relaxed text-lg">
                Built on the Messaging Layer Security protocol—the same standard
                adopted by major messaging platforms.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-12">
              {features.map((feature) => (
                <div key={feature.title} className="group cursor-pointer">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-500 group-hover:rotate-12 border border-blue-100">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-4 group-hover:text-blue-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed font-light">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security Details */}
        <section id="security" className="py-24 px-6 overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2
                className="text-4xl md:text-5xl mb-6 font-semibold italic text-slate-900"
                style={{ fontFamily: 'Bodoni Moda, serif' }}
              >
                Security You Can Verify.
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto font-light leading-relaxed text-lg">
                We believe in honest security claims. Here's exactly what we do
                and don't protect.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
              {/* What We Promise */}
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-lg">
                <h3 className="text-xl font-bold mb-6 text-slate-900">
                  What We Promise
                </h3>
                <div className="space-y-4">
                  {promises.map((promise) => (
                    <div key={promise} className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-green-600" />
                      </div>
                      <span className="text-gray-600 font-light">
                        {promise}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* What We Don't Promise */}
              <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200">
                <h3 className="text-xl font-bold mb-6 text-slate-900">
                  What We Don't Promise
                </h3>
                <div className="space-y-4">
                  {limitations.map((limitation) => (
                    <div key={limitation} className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <Warning className="w-3 h-3 text-amber-600" />
                      </div>
                      <span className="text-gray-600 font-light">
                        {limitation}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-6">
          <motion.div
            whileHover={{ y: -5 }}
            className="max-w-5xl mx-auto rounded-[3.5rem] bg-foreground text-white p-12 md:p-24 text-center relative overflow-hidden shadow-2xl"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/10 blur-[120px] pointer-events-none"></div>

            <h2
              className="text-4xl md:text-7xl mb-8 relative z-10 font-semibold italic"
              style={{ fontFamily: 'Bodoni Moda, serif' }}
            >
              Private Conversations, Honest Security.
            </h2>
            <p className="text-gray-400 text-lg md:text-xl mb-12 max-w-xl mx-auto font-light leading-relaxed relative z-10">
              Built on audited protocols, not marketing claims. Your messages
              are encrypted with MLS—the same standard used by major messaging
              platforms.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 relative z-10">
              <Link
                href="/chat"
                className="w-full sm:w-auto bg-blue-600 text-white px-12 py-5 rounded-full font-bold text-xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30 cursor-pointer active:scale-95 text-center"
              >
                Create Private Group
              </Link>
              <a
                href="/protocol"
                className="text-white/60 hover:text-white transition-colors flex items-center gap-2 group cursor-pointer text-lg"
              >
                Read the Whitepaper
                <CaretRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </motion.div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
