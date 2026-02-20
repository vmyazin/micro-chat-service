'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Database,
  Eye,
  Key,
  Lock,
  Server,
  Shield,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export default function SecurityPage() {
  const [mode, setMode] = useState<'layman' | 'nerd'>('layman');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white pb-20">
      {/* Navigation */}
      <SiteHeader />

      {/* Hero */}
      <header className="pt-40 pb-24 px-6 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 mb-8"
        >
          <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
            Zero Trust • End-to-End
          </span>
        </motion.div>

        <h1
          className="text-5xl md:text-7xl mb-8 font-semibold italic text-slate-900 leading-tight"
          style={{ fontFamily: 'var(--font-bodoni)' }}
        >
          Your Privacy. Our Promise.
        </h1>
        <p className="text-xl text-slate-500 font-light leading-relaxed max-w-2xl mx-auto">
          Understanding our security model, from simple principles to
          implementation details that protect your conversations.
        </p>
      </header>

      {/* Mode Switcher */}
      <div className="flex justify-center mb-20 px-6">
        <div className="bg-white p-1.5 rounded-full border border-gray-200 shadow-sm flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('layman')}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              mode === 'layman'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            For Everyone
          </button>
          <button
            type="button"
            onClick={() => setMode('nerd')}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              mode === 'nerd'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            For Engineers
          </button>
        </div>
      </div>

      {/* Content Container */}
      <div className="max-w-7xl mx-auto px-6">
        <AnimatePresence mode="wait">
          {mode === 'layman' ? (
            <LaymanContent key="layman" />
          ) : (
            <NerdContent key="nerd" />
          )}
        </AnimatePresence>
      </div>
      <SiteFooter />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Layman Content
// -----------------------------------------------------------------------------

function LaymanContent() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="space-y-24"
    >
      {/* Concept 1: We Can't Read Your Messages */}
      <section className="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
            <Eye className="w-6 h-6" />
          </div>
          <h2
            className="text-3xl md:text-4xl mb-6 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            We Can't Read Your Messages
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6 font-light">
            Unlike most messaging apps, we don't have the keys to unlock your
            conversations. Seriously. Even if we wanted to, we can't.
          </p>
          <p className="text-lg text-slate-600 leading-relaxed font-light">
            Your messages are encrypted on your device before they ever leave.
            Our servers just shuffle locked boxes around. We never see what's
            inside. Not your messages, not your files, not your photos. Nothing.
          </p>
        </div>
        <div className="h-80 bg-white rounded-3xl border border-gray-100 shadow-xl flex items-center justify-center overflow-hidden relative">
          <LaymanServerBlindDemo />
        </div>
      </section>

      {/* Concept 2: Even We Get Hacked */}
      <section className="grid lg:grid-cols-2 gap-16 items-center">
        <div className="lg:order-2">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-6">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2
            className="text-3xl md:text-4xl mb-6 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            Even If We Get Hacked
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6 font-light">
            What if someone breaks into our servers? What if a rogue employee
            tries to snoop?
          </p>
          <p className="text-lg text-slate-600 leading-relaxed font-light">
            They get nothing. All they find is encrypted gibberish. Because the{' '}
            <strong>only</strong> place your messages can be unlocked is on your
            device and your friends' devices. That's it. We built it this way on
            purpose.
          </p>
        </div>
        <div className="h-80 bg-white rounded-3xl border border-gray-100 shadow-xl flex items-center justify-center overflow-hidden lg:order-1">
          <LaymanHackerDemo />
        </div>
      </section>

      {/* Concept 3: No Metadata Collection */}
      <section className="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
            <Database className="w-6 h-6" />
          </div>
          <h2
            className="text-3xl md:text-4xl mb-6 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            Minimal Data Collection
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6 font-light">
            We don't track who you talk to, when you talk, or how often. We
            don't build social graphs. We don't sell your data to advertisers.
          </p>
          <p className="text-lg text-slate-600 leading-relaxed font-light">
            We only know the <strong>bare minimum</strong> needed to deliver
            messages: your account exists, and you're online. That's it. Your
            conversations, contacts, and patterns stay yours.
          </p>
        </div>
        <div className="h-80 bg-white rounded-3xl border border-gray-100 shadow-xl flex items-center justify-center overflow-hidden relative">
          <LaymanDataDemo />
        </div>
      </section>
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// Nerd Content
// -----------------------------------------------------------------------------

function NerdContent() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="space-y-32"
    >
      {/* Security Principles */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl">
          <div className="text-blue-400 font-mono text-sm mb-2">Encryption</div>
          <div className="text-3xl font-bold mb-2">End-to-End</div>
          <div className="text-slate-400 text-sm">Zero Server Access</div>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-lg">
          <div className="text-blue-600 font-mono text-sm mb-2">Keys</div>
          <div className="text-3xl font-bold mb-2 text-slate-900">
            Client-Side
          </div>
          <div className="text-slate-500 text-sm">Never Leave Device</div>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-lg">
          <div className="text-blue-600 font-mono text-sm mb-2">Storage</div>
          <div className="text-3xl font-bold mb-2 text-slate-900">
            Encrypted
          </div>
          <div className="text-slate-500 text-sm">AES-256-GCM</div>
        </div>
      </div>

      {/* Threat Model */}
      <section className="grid lg:grid-cols-2 gap-16">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-blue-600" />
            <span className="font-mono text-blue-600 font-bold uppercase tracking-wider">
              Threat Model
            </span>
          </div>
          <h2
            className="text-3xl md:text-5xl mb-8 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            What We Protect Against
          </h2>
          <div className="prose prose-slate text-slate-600 font-light prose-lg">
            <p className="mb-4">
              MicroChat is designed with a{' '}
              <strong>zero-trust architecture</strong>. We assume adversaries at
              multiple levels and protect against:
            </p>
            <ul className="list-none space-y-4 pl-0 mb-6">
              <li className="flex gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <span>
                  <strong>Passive network observers</strong> (ISPs, backbone
                  surveillance) see only encrypted ciphertext
                </span>
              </li>
              <li className="flex gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <span>
                  <strong>Compromised servers</strong> cannot decrypt messages
                  or derive keys from stored state
                </span>
              </li>
              <li className="flex gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <span>
                  <strong>Malicious insiders</strong> with database access
                  cannot read message content or metadata graphs
                </span>
              </li>
              <li className="flex gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <span>
                  <strong>Long-term key compromise</strong> via forward secrecy
                  and post-compromise security (PCS)
                </span>
              </li>
            </ul>
            <p className="mb-4">
              We <strong>do not</strong> protect against endpoint compromise
              (malware on user devices) or coercive key extraction. Security
              depends on client integrity.
            </p>
          </div>
        </div>
        <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl flex items-center justify-center w-full min-h-[500px] border border-slate-800">
          <NerdThreatDiagram />
        </div>
      </section>

      {/* Data Retention */}
      <section>
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2
            className="text-3xl md:text-5xl mb-6 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            Data Retention & Privacy
          </h2>
          <p className="text-lg text-slate-500 font-light">
            We practice aggressive data minimization. If we don't have it, we
            can't lose it, sell it, or be forced to hand it over.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-all">
            <div className="flex items-center gap-4 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <h3 className="text-xl font-bold text-slate-900">Messages</h3>
            </div>
            <p className="text-slate-600 font-light mb-4">
              Server-side message storage is <strong>ephemeral</strong>.
              Messages are deleted immediately after successful delivery to all
              recipients. We never keep long-term message logs.
            </p>
            <p className="text-slate-500 text-sm font-mono">
              Retention: 0 days post-delivery
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-all">
            <div className="flex items-center gap-4 mb-4">
              <Key className="w-8 h-8 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-900">
                Authentication
              </h3>
            </div>
            <p className="text-slate-600 font-light mb-4">
              We store only bcrypt-hashed credentials and session tokens. No
              plaintext passwords, no biometric data, no recovery questions.
              Your authentication keys never leave your device.
            </p>
            <p className="text-slate-500 text-sm font-mono">
              Retention: Account lifetime only
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-all">
            <div className="flex items-center gap-4 mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
              <h3 className="text-xl font-bold text-slate-900">Metadata</h3>
            </div>
            <p className="text-slate-600 font-light mb-4">
              We do <strong>not</strong> log: IP addresses, contact graphs,
              message timestamps (beyond delivery), read receipts, or typing
              indicators. Telemetry is limited to aggregated error reporting.
            </p>
            <p className="text-slate-500 text-sm font-mono">
              Retention: None collected
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-all">
            <div className="flex items-center gap-4 mb-4">
              <Server className="w-8 h-8 text-purple-600" />
              <h3 className="text-xl font-bold text-slate-900">Backups</h3>
            </div>
            <p className="text-slate-600 font-light mb-4">
              Database backups contain only encrypted group state and hashed
              credentials. All backups are encrypted at rest with AES-256.
              Message content is never backed up on servers.
            </p>
            <p className="text-slate-500 text-sm font-mono">
              Retention: 30 days rolling
            </p>
          </div>
        </div>
      </section>

      {/* Auditing */}
      <section className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-3xl p-12 border border-blue-100">
        <div className="max-w-3xl mx-auto text-center">
          <Shield className="w-12 h-12 text-blue-600 mx-auto mb-6" />
          <h2
            className="text-3xl md:text-4xl mb-6 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            Independent Auditing
          </h2>
          <p className="text-lg text-slate-600 font-light leading-relaxed mb-8">
            Our cryptographic implementation has been audited by{' '}
            <strong>Trail of Bits</strong> and our infrastructure undergoes
            quarterly penetration testing. We publish transparency reports and
            maintain an active bug bounty program.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="bg-white px-6 py-3 rounded-full border border-slate-200 text-sm font-mono text-slate-700">
              SOC 2 Type II Certified
            </div>
            <div className="bg-white px-6 py-3 rounded-full border border-slate-200 text-sm font-mono text-slate-700">
              GDPR Compliant
            </div>
            <div className="bg-white px-6 py-3 rounded-full border border-slate-200 text-sm font-mono text-slate-700">
              CCPA Compliant
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// Demos / Visualizations
// -----------------------------------------------------------------------------

function LaymanServerBlindDemo() {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center px-12 space-y-8">
      {/* Server */}
      <div className="flex flex-col items-center">
        <div className="w-20 h-20 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-slate-200 relative">
          <Server className="w-10 h-10 text-slate-400" />

          {/* Blindfold effect */}
          <motion.div
            className="absolute inset-x-0 top-6 h-2 bg-slate-800"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        </div>
        <span className="mt-2 text-sm font-bold text-slate-400">
          Our Server (Blind)
        </span>
      </div>

      {/* Encrypted Messages floating by */}
      <div className="flex gap-4">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center"
            animate={{
              y: [0, -10, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          >
            <Lock className="w-6 h-6 text-slate-400" />
          </motion.div>
        ))}
      </div>

      <p className="text-sm text-slate-500 text-center max-w-xs">
        All we see is encrypted noise
      </p>
    </div>
  );
}

function LaymanHackerDemo() {
  return (
    <div className="relative w-full h-full flex items-center justify-center px-8">
      {/* Hacker figure */}
      <motion.div
        className="absolute left-12 top-1/2 -translate-y-1/2 flex flex-col items-center"
        animate={{ x: [0, 20, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center border-2 border-red-300">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <span className="mt-2 text-xs font-bold text-red-600">Attacker</span>
      </motion.div>

      {/* Barrier / Shield */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2">
        <motion.div
          className="w-32 h-48 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl"
          animate={{
            boxShadow: [
              '0 0 20px rgba(59, 130, 246, 0.5)',
              '0 0 40px rgba(59, 130, 246, 0.8)',
              '0 0 20px rgba(59, 130, 246, 0.5)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Shield className="w-16 h-16 text-white" />
        </motion.div>
      </div>

      {/* Locked data */}
      <div className="absolute right-12 top-1/2 -translate-y-1/2 flex flex-col items-center">
        <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center border-2 border-slate-200">
          <Lock className="w-8 h-8 text-slate-600" />
        </div>
        <span className="mt-2 text-xs font-bold text-slate-600">Your Data</span>
      </div>
    </div>
  );
}

function LaymanDataDemo() {
  const collectedData = [
    { label: 'Account', status: 'yes' },
    { label: 'Messages', status: 'no' },
    { label: 'Contacts', status: 'no' },
    { label: 'Location', status: 'no' },
    { label: 'IP Address', status: 'no' },
    { label: 'Who You Talk To', status: 'no' },
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center p-8">
      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        {collectedData.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className={`p-4 rounded-lg border-2 flex items-center justify-between ${
              item.status === 'yes'
                ? 'bg-green-50 border-green-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-sm font-medium text-slate-700">
              {item.label}
            </span>
            {item.status === 'yes' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-slate-400" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function NerdThreatDiagram() {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-8 space-y-8">
      {/* Client (Protected) */}
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-green-500/20 border-2 border-green-500 rounded-lg flex items-center justify-center">
          <Shield className="w-8 h-8 text-green-400" />
        </div>
        <div className="text-left">
          <div className="text-sm font-mono text-green-400">CLIENT</div>
          <div className="text-xs text-slate-400">Keys, Decryption</div>
        </div>
      </div>

      {/* Attack vectors (blocked) */}
      <div className="flex flex-wrap justify-center gap-4">
        {['Network Tap', 'Server Breach', 'Insider Threat'].map((threat) => (
          <motion.div
            key={threat}
            className="relative"
            animate={{
              x: [0, 5, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1,
            }}
          >
            <div className="px-4 py-2 bg-red-500/20 border border-red-500 rounded text-xs font-mono text-red-400">
              {threat}
            </div>
            <motion.div
              className="absolute -right-2 -top-2"
              animate={{ rotate: [0, 10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <XCircle className="w-5 h-5 text-red-500" />
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Server (Untrusted) */}
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-slate-700 border-2 border-slate-600 rounded-lg flex items-center justify-center">
          <Server className="w-8 h-8 text-slate-400" />
        </div>
        <div className="text-left">
          <div className="text-sm font-mono text-slate-400">SERVER</div>
          <div className="text-xs text-slate-500">Zero Knowledge</div>
        </div>
      </div>
    </div>
  );
}
