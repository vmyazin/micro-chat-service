'use client';

import {
  ArrowClockwiseIcon,
  FileCodeIcon,
  GhostIcon,
  LockIcon,
  ShieldIcon,
  TerminalIcon,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { LaymanEncryptionDemo } from './demos/LaymanEncryptionDemo';
import { LaymanGhostDemo } from './demos/LaymanGhostDemo';
import { LaymanRatchetDemo } from './demos/LaymanRatchetDemo';
import { NerdGhostDemo } from './demos/NerdGhostDemo';
import { NerdTreeDemo } from './demos/NerdTreeDemo';

export default function ProtocolPage() {
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
            RFC 9420 • MLS Standard
          </span>
        </motion.div>

        <h1
          className="text-5xl md:text-7xl mb-8 font-semibold italic text-slate-900 leading-tight"
          style={{ fontFamily: 'var(--font-bodoni)' }}
        >
          How We Keep It Secret.
        </h1>
        <p className="text-xl text-slate-500 font-light leading-relaxed max-w-2xl mx-auto">
          Understanding the cryptographic machinery behind MicroChat, from
          simple analogies to deep protocol mechanics.
        </p>
      </header>

      {/* Mode Switcher */}
      <div className="flex justify-center mb-20 px-6">
        <div className="bg-white p-1.5 rounded-full border border-gray-200 shadow-sm flex items-center gap-1">
          <Button
            variant="ghost"
            type="button"
            onClick={() => setMode('layman')}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              mode === 'layman'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            For Everyone
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setMode('nerd')}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              mode === 'nerd'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            For Engineers
          </Button>
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
      {/* Concept 1: The Sealed Envelope */}
      <section className="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
            <LockIcon className="w-6 h-6" />
          </div>
          <h2
            className="text-3xl md:text-4xl mb-6 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            The Sealed Box
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6 font-light">
            Imagine you want to send a letter to your friend, but you have to
            pass it through a stranger's house (our servers).
          </p>
          <p className="text-lg text-slate-600 leading-relaxed font-light">
            With standard messaging, you trust the stranger not to open the
            envelope. With MicroChat, you put the letter in a{' '}
            <strong>steel box</strong> that only you and your friend have keys
            to. The stranger passes the box along, but can never open it.
          </p>
        </div>
        <div className="h-80 bg-white rounded-3xl border border-gray-100 shadow-xl flex items-center justify-center overflow-hidden relative">
          <LaymanEncryptionDemo />
        </div>
      </section>

      {/* Concept 2: The Shredder */}
      <section className="grid lg:grid-cols-2 gap-16 items-center">
        <div className="lg:order-2">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-6">
            <ShieldIcon className="w-6 h-6" />
          </div>
          <h2
            className="text-3xl md:text-4xl mb-6 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            Self-Destructing Keys
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6 font-light">
            What if someone steals your key tomorrow? Can they read your
            messages from last year?
          </p>
          <p className="text-lg text-slate-600 leading-relaxed font-light">
            No. MicroChat changes the locks on the box{' '}
            <strong>with every single message</strong>. Once you open a message,
            the key used to lock it is shredded. Even if a thief steals your
            keys today, they can never unlock the boxes from yesterday. This is
            called "Forward Secrecy".
          </p>
        </div>
        <div className="h-80 bg-white rounded-3xl border border-gray-100 shadow-xl flex items-center justify-center overflow-hidden lg:order-1">
          <LaymanRatchetDemo />
        </div>
      </section>

      {/* Concept 3: The GhostIcon Courier */}
      <section className="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
            <GhostIcon className="w-6 h-6" />
          </div>
          <h2
            className="text-3xl md:text-4xl mb-6 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            The GhostIcon Courier
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6 font-light">
            Normally, the stranger carrying your box (our server) knows exactly
            who sent it and who it's going to.
          </p>
          <p className="text-lg text-slate-600 leading-relaxed font-light">
            In MicroChat, we use a system called <strong>Sealed Sender</strong>.
            You take an anonymous delivery token and drop off the box. The
            server verifies the token but has no idea who you actually are. You
            are a ghost.
          </p>
        </div>
        <div className="h-80 bg-white rounded-3xl border border-purple-100 shadow-xl flex items-center justify-center overflow-hidden relative">
          <LaymanGhostDemo />
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
      {/* Intro Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-amber-500/20 text-amber-500 text-[10px] font-bold px-2 py-1 rounded tracking-widest uppercase">
            In Progress
          </div>
          <div className="text-blue-400 font-mono text-sm mb-2">Protocol</div>
          <div className="text-3xl font-bold mb-2">MLS</div>
          <div className="text-slate-400 text-sm">RFC 9420 Standard</div>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-lg relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded tracking-widest uppercase">
            In Progress
          </div>
          <div className="text-blue-600 font-mono text-sm mb-2">Topology</div>
          <div className="text-3xl font-bold mb-2 text-slate-900">TreeKEM</div>
          <div className="text-slate-500 text-sm">Logarithmic Efficiency</div>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-lg relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded tracking-widest uppercase">
            In Progress
          </div>
          <div className="text-blue-600 font-mono text-sm mb-2">Primitives</div>
          <div className="text-3xl font-bold mb-2 text-slate-900">HPKE</div>
          <div className="text-slate-500 text-sm">Hybrid Public Key Enc.</div>
        </div>
      </div>

      {/* Technical Deep Dive 1: TreeKEM */}
      <section className="grid lg:grid-cols-2 gap-16">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <TerminalIcon className="w-6 h-6 text-blue-600" />
            <span className="font-mono text-blue-600 font-bold uppercase tracking-wider">
              The Architecture
            </span>
          </div>
          <h2
            className="text-3xl md:text-5xl mb-8 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            TreeKEM & Continuous Group Key Agreement
          </h2>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider mb-6">
            Currently In Development
          </div>
          <div className="prose prose-slate text-slate-600 font-light prose-lg">
            <p className="mb-4">
              MicroChat implements{' '}
              <strong>Messaging Layer Security (MLS)</strong>, which solves the
              scalability issues of pairwise encryption (Signal Protocol) in
              large groups.
            </p>
            <p className="mb-4">
              Instead of encrypting a message N times for N recipients, MLS
              arranges members in a <strong>left-balanced binary tree</strong>{' '}
              (Ratchet Tree). Each node in the tree represents a public/private
              key pair.
            </p>
            <ul className="list-none space-y-3 pl-0 mb-6">
              <li className="flex gap-3">
                <span className="text-blue-600 font-bold">1.</span>
                <span>
                  <strong>Leaf Nodes:</strong> Represent individual members.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-600 font-bold">2.</span>
                <span>
                  <strong>Path Secrets:</strong> Members know all private keys
                  on their direct path to the root.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-600 font-bold">3.</span>
                <span>
                  <strong>Root Key:</strong> The shared group secret used to
                  derive message encryption keys.
                </span>
              </li>
            </ul>
            <p>
              When a member updates their key (Post-Compromise Security), they
              generate a new path secret and encrypt it up the tree. This
              achieves <strong>O(log N)</strong> efficiency for group
              operations.
            </p>
          </div>
        </div>
        <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl flex items-center justify-center w-full min-h-[500px] border border-slate-800">
          <NerdTreeDemo />
        </div>
      </section>

      {/* Technical Deep Dive 2: Erasure */}
      <section>
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2
            className="text-3xl md:text-5xl mb-6 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            Epochs & Erasure
          </h2>
          <p className="text-lg text-slate-500 font-light">
            The state of the group advances in discrete <strong>Epochs</strong>.
            Each operation (add, remove, update, message) transitions the group
            to Epoch N+1.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-all">
            <div className="flex items-center gap-4 mb-4">
              <ArrowClockwiseIcon className="w-8 h-8 text-green-600" />
              <h3 className="text-xl font-bold text-slate-900">
                Forward Secrecy
              </h3>
            </div>
            <p className="text-slate-600 font-light">
              Key material for Epoch N is derived from Epoch N-1 via a one-way
              KDF chain. Once Epoch N-1 is deleted, its keys cannot be
              re-derived, ensuring past messages remain secure even if current
              state is compromised.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-all">
            <div className="flex items-center gap-4 mb-4">
              <FileCodeIcon className="w-8 h-8 text-red-500" />
              <h3 className="text-xl font-bold text-slate-900">
                Post-Compromise Security
              </h3>
            </div>
            <p className="text-slate-600 font-light">
              If an attacker compromises a device, they can be healed out of the
              group. As soon as the compromised member (or any other member)
              sends a Key Update, the new entropy restores the group's security,
              locking out the attacker from future messages.
            </p>
          </div>
        </div>
      </section>

      {/* Technical Deep Dive 3: Sealed Sender */}
      <section className="grid lg:grid-cols-2 gap-16">
        <div className="lg:order-2">
          <div className="flex items-center gap-3 mb-6">
            <GhostIcon className="w-6 h-6 text-purple-600" />
            <span className="font-mono text-purple-600 font-bold uppercase tracking-wider">
              Anonymity
            </span>
          </div>
          <h2
            className="text-3xl md:text-5xl mb-8 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            Sealed Sender Routing
          </h2>
          <div className="prose prose-slate text-slate-600 font-light prose-lg">
            <p className="mb-4">
              MicroChat implements <strong>Sealed Sender</strong> to decouple
              message routing from sender identity. Network metadata is often as
              sensitive as the message contents.
            </p>
            <p className="mb-4">
              Our implementation issues cryptographic blinding tokens to clients
              representing "the right to send one message".
            </p>
            <ul className="list-none space-y-3 pl-0 mb-6">
              <li className="flex gap-3">
                <span className="text-purple-600 font-bold">1.</span>
                <span>
                  <strong>Token Issuance:</strong> Clients fetch batches of
                  32-byte secure random tokens.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-purple-600 font-bold">2.</span>
                <span>
                  <strong>Server Blindness:</strong> The server only stores the
                  SHA-256 hash of tokens. It cannot link a token back to the
                  requesting user.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-purple-600 font-bold">3.</span>
                <span>
                  <strong>Anonymous Delivery:</strong> Messages are sent with{' '}
                  <code>sender_id = NULL</code> and a valid plaintext token.
                </span>
              </li>
            </ul>
            <p>
              The true sender identity is embedded inside the AES-GCM encrypted
              payload, accessible only by group members with the current epoch
              key.
            </p>
          </div>
        </div>
        <div className="bg-purple-50 rounded-3xl p-8 shadow-inner flex items-center justify-center w-full min-h-[500px] border border-purple-100 lg:order-1 relative overflow-hidden">
          <NerdGhostDemo />
        </div>
      </section>
    </motion.div>
  );
}

// Demos live in ./demos/ — one file per component.
