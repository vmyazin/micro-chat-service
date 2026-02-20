'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  FileCode,
  Ghost,
  Key,
  Lock,
  RefreshCw,
  Server,
  Shield,
  Terminal,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

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
      {/* Concept 1: The Sealed Envelope */}
      <section className="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
            <Lock className="w-6 h-6" />
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
            <Shield className="w-6 h-6" />
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

      {/* Concept 3: The Ghost Courier */}
      <section className="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
            <Ghost className="w-6 h-6" />
          </div>
          <h2
            className="text-3xl md:text-4xl mb-6 font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-bodoni)' }}
          >
            The Ghost Courier
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
            <Terminal className="w-6 h-6 text-blue-600" />
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
              <RefreshCw className="w-8 h-8 text-green-600" />
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
              <FileCode className="w-8 h-8 text-red-500" />
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
            <Ghost className="w-6 h-6 text-purple-600" />
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

// -----------------------------------------------------------------------------
// Demos / Graphs
// -----------------------------------------------------------------------------

function LaymanEncryptionDemo() {
  return (
    <div className="relative w-full h-full flex items-center justify-between px-12">
      {/* Alice */}
      <div className="flex flex-col items-center z-10">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center border-2 border-blue-200">
          <Users className="w-8 h-8 text-blue-600" />
        </div>
        <span className="mt-2 text-sm font-bold text-slate-500">You</span>
      </div>

      {/* Server */}
      <div className="flex flex-col items-center z-10 relative">
        <div className="w-20 h-20 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-slate-200">
          <Server className="w-10 h-10 text-slate-400" />
        </div>
        <span className="mt-2 text-sm font-bold text-slate-400">Server</span>

        {/* The "Shield" that blocks the server */}
        <motion.div
          className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full p-1 shadow-lg z-20"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <Lock className="w-4 h-4" />
        </motion.div>
      </div>

      {/* Bob */}
      <div className="flex flex-col items-center z-10">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center border-2 border-green-200">
          <Users className="w-8 h-8 text-green-600" />
        </div>
        <span className="mt-2 text-sm font-bold text-slate-500">Friend</span>
      </div>

      {/* Animated Message */}
      <motion.div
        className="absolute top-1/2 left-0 w-12 h-8 bg-white border-2 border-blue-600 rounded flex items-center justify-center shadow-lg text-blue-600 z-0"
        initial={{ x: 80, opacity: 0, rotate: 0 }}
        animate={{
          x: ['10%', '50%', '90%'],
          opacity: [0, 1, 1, 1, 0],
          backgroundColor: ['#ffffff', '#1e293b', '#ffffff'],
          borderColor: ['#2563eb', '#000000', '#2563eb'],
          color: ['#2563eb', '#ffffff', '#2563eb'],
        }}
        transition={{
          duration: 4,
          ease: 'linear',
          repeat: Infinity,
          times: [0, 0.4, 0.6, 1],
        }}
        style={{ marginTop: -16 }} // Center vertically
      >
        <Lock className="w-4 h-4" />
      </motion.div>
    </div>
  );
}

function LaymanRatchetDemo() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8">
      <div className="flex gap-4">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="w-16 h-20 rounded-lg border-2 flex flex-col items-center justify-center relative shadow-sm"
            animate={{
              borderColor:
                i === 1
                  ? ['#e2e8f0', '#e2e8f0', '#ef4444', '#e2e8f0']
                  : '#e2e8f0',
              opacity: i === 1 ? [1, 1, 0, 0] : 1,
              x: i === 1 ? [0, 0, 50, 50] : 0, // Fly away
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              times: [0, 0.3, 0.5, 1],
            }}
          >
            {i === 1 ? (
              <Key className="w-6 h-6 text-slate-400" />
            ) : (
              <Lock className="w-6 h-6 text-slate-400" />
            )}
            <span className="text-xs text-slate-400 mt-2">Msg {i}</span>

            {/* Shredding Effect for Key 1 */}
            {i === 1 && (
              <motion.div
                className="absolute inset-0 bg-red-100/50 flex items-center justify-center text-red-600 font-bold uppercase rotate-12 border-4 border-red-500 rounded-lg"
                initial={{ opacity: 0, scale: 2 }}
                animate={{ opacity: [0, 0, 1, 0], scale: [2, 2, 1, 0.5] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  times: [0, 0.3, 0.4, 0.6],
                }}
              >
                SHRED
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-8 text-sm font-mono text-blue-600 bg-blue-50 px-4 py-2 rounded-full"
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity, times: [0.5, 0.6, 1] }}
      >
        Generaring New Key...
      </motion.div>
    </div>
  );
}

function NerdTreeDemo() {
  // Simplified Visual of a 4-leaf tree
  //        Root
  //     /        \
  //   Node A    Node B
  //   /  \      /   \
  //  U1  U2    U3   U4

  const treeVariants = {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1, transition: { duration: 1 } },
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none stroke-slate-700"
        style={{ overflow: 'visible' }}
      >
        {/* Lines connecting nodes */}
        {/* Root to A */}
        <motion.line
          x1="50%"
          y1="20%"
          x2="25%"
          y2="50%"
          strokeWidth="2"
          variants={treeVariants}
        />
        {/* Root to B */}
        <motion.line
          x1="50%"
          y1="20%"
          x2="75%"
          y2="50%"
          strokeWidth="2"
          variants={treeVariants}
        />
        {/* A to U1 */}
        <motion.line
          x1="25%"
          y1="50%"
          x2="12%"
          y2="80%"
          strokeWidth="2"
          variants={treeVariants}
        />
        {/* A to U2 */}
        <motion.line
          x1="25%"
          y1="50%"
          x2="38%"
          y2="80%"
          strokeWidth="2"
          variants={treeVariants}
        />
        {/* B to U3 */}
        <motion.line
          x1="75%"
          y1="50%"
          x2="62%"
          y2="80%"
          strokeWidth="2"
          variants={treeVariants}
        />
        {/* B to U4 */}
        <motion.line
          x1="75%"
          y1="50%"
          x2="88%"
          y2="80%"
          strokeWidth="2"
          variants={treeVariants}
        />
      </svg>

      {/* Root Node */}
      <motion.div
        className="absolute top-[15%] left-1/2 -translate-x-1/2 w-12 h-12 rounded-full border-2 border-green-500 bg-slate-800 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)] z-10"
        animate={{ borderColor: ['#22c55e', '#ef4444', '#22c55e'] }}
        transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
      >
        <Lock className="w-5 h-5 text-white" />
      </motion.div>

      {/* Level 1 Nodes */}
      <motion.div className="absolute top-[45%] left-[25%] -translate-x-1/2 w-10 h-10 rounded-full border-2 border-slate-600 bg-slate-800 z-10" />
      <motion.div
        className="absolute top-[45%] left-[75%] -translate-x-1/2 w-10 h-10 rounded-full border-2 border-slate-600 bg-slate-800 z-10"
        animate={{ borderColor: ['#475569', '#ef4444', '#475569'] }}
        transition={{ duration: 4, repeat: Infinity, repeatDelay: 2, delay: 1 }}
      />

      {/* Level 2 Nodes (Users) */}
      <div className="absolute top-[75%] left-[12%] -translate-x-1/2 flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
          <Users className="w-5 h-5 text-slate-400" />
        </div>
        <span className="text-xs text-slate-500 mt-2">U1</span>
      </div>
      <div className="absolute top-[75%] left-[38%] -translate-x-1/2 flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
          <Users className="w-5 h-5 text-slate-400" />
        </div>
        <span className="text-xs text-slate-500 mt-2">U2</span>
      </div>
      <div className="absolute top-[75%] left-[62%] -translate-x-1/2 flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
          <Users className="w-5 h-5 text-slate-400" />
        </div>
        <span className="text-xs text-slate-500 mt-2">U3</span>
      </div>

      {/* Updating User U4 */}
      <motion.div
        className="absolute top-[75%] left-[88%] -translate-x-1/2 flex flex-col items-center z-20"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 5.5 }}
      >
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
          <RefreshCw className="w-5 h-5 text-white" />
        </div>
        <span className="text-xs text-blue-400 mt-2 font-bold">Update</span>
      </motion.div>

      {/* Update Path Animation */}
      <motion.div
        className="absolute top-[63%] left-[81%] w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_red]"
        animate={{ x: -20, y: -50, opacity: [0, 1, 0] }}
        transition={{
          duration: 1,
          repeat: Infinity,
          repeatDelay: 5,
          delay: 0.5,
        }}
      />
      <motion.div
        className="absolute top-[35%] left-[63%] w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_red]"
        animate={{ x: -50, y: -50, opacity: [0, 1, 0] }}
        transition={{
          duration: 1,
          repeat: Infinity,
          repeatDelay: 5,
          delay: 1.5,
        }}
      />
    </div>
  );
}

function LaymanGhostDemo() {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-50 px-8">
      <motion.div
        className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center border-2 border-purple-200 z-10"
        initial={{ opacity: 1 }}
        animate={{
          opacity: [1, 0.2, 1],
          filter: ['blur(0px)', 'blur(4px)', 'blur(0px)'],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Ghost className="w-8 h-8 text-purple-600" />
      </motion.div>
      <div className="mt-8 text-sm font-mono text-purple-600 bg-purple-50 border border-purple-100 px-4 py-2 rounded-full flex items-center gap-2">
        <Key className="w-4 h-4" />
        One-Time Delivery Token
      </div>
    </div>
  );
}

function NerdGhostDemo() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 w-full text-center">
      <div className="flex items-center gap-4">
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-xs text-slate-400 font-mono mb-1">Client</div>
          <div className="text-sm font-bold">Token: 8f4a...2bc9</div>
        </div>
        <motion.div
          animate={{ x: [0, 40, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-purple-500"
        >
          ➔
        </motion.div>
        <div className="p-4 bg-slate-900 rounded-xl shadow-sm text-white">
          <div className="text-xs text-slate-400 font-mono mb-1">Server DB</div>
          <div className="text-sm font-mono text-green-400">SHA256(Token)</div>
        </div>
      </div>
      <div className="mt-8 p-6 bg-white rounded-xl shadow-lg border border-gray-100 text-left w-full max-w-sm">
        <div className="text-xs font-mono text-slate-400 mb-2 border-b pb-2">
          POST /api/messages
        </div>
        <div className="font-mono text-sm space-y-1 mt-2">
          <div>
            <span className="text-blue-500">group_id:</span> "cf8a-..."
          </div>
          <div>
            <span className="text-blue-500">sender_id:</span>{' '}
            <span className="text-purple-600 font-bold italic">null</span>
          </div>
          <div>
            <span className="text-blue-500">token:</span> "8f4a...2bc9"
          </div>
          <div>
            <span className="text-blue-500">payload:</span> "U2FsdGVk..."
          </div>
        </div>
      </div>
    </div>
  );
}
