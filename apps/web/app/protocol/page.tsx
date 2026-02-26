'use client';

import {
  ArrowClockwiseIcon,
  FileCodeIcon,
  GhostIcon,
  HardDrivesIcon,
  KeyIcon,
  LockIcon,
  ShieldIcon,
  TerminalIcon,
  UsersIcon,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
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

// -----------------------------------------------------------------------------
// Demos / Graphs
// -----------------------------------------------------------------------------

function LaymanEncryptionDemo() {
  // Forward  (0–6):  You → Server (blocked) → Friend
  // Reverse  (7–13): Friend → Server (blocked) → You
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const DURATIONS = [
      // forward
      1600, 650, 850, 1300, 850, 650, 1300,
      // reverse
      1100, 650, 850, 1300, 850, 650, 1600,
    ];
    const ids: ReturnType<typeof setTimeout>[] = [];

    const cycle = () => {
      let t = 0;
      DURATIONS.forEach((d, i) => {
        ids.push(setTimeout(() => setPhase(i), t));
        t += d;
      });
      ids.push(setTimeout(cycle, t));
    };

    cycle();
    return () => ids.forEach(clearTimeout);
  }, []);

  const LABELS = [
    'Writing a message…',   // 0
    'Sealing the box…',     // 1
    'In transit…',          // 2
    "Server can't read it", // 3
    'Forwarding…',          // 4
    'Opening the box…',     // 5
    'Message delivered!',   // 6
    'Friend is replying…',  // 7
    'Sealing the box…',     // 8
    'In transit…',          // 9
    "Server can't read it", // 10
    'Forwarding…',          // 11
    'Opening the reply…',   // 12
    'Reply received!',      // 13
  ];

  // Message x-position: forward travels left→center→right, reverse goes right→center→left
  const msgLeft =
    phase <= 1   ? '15%'
    : phase <= 3 ? '50%'
    : phase <= 8 ? '85%'
    : phase <= 10 ? '50%'
    : '15%';

  const isSealed = (phase >= 1 && phase <= 5) || (phase >= 8 && phase <= 12);
  const serverBlocked = phase === 3 || phase === 10;
  const isReply = phase >= 7; // green-tinted message on the return trip

  // Key pulse: which side is locking/unlocking this phase
  const aliceKeyActive = phase === 1 || phase === 12;
  const bobKeyActive   = phase === 5 || phase === 8;

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-gradient-to-b from-slate-50/50 to-white">
      {/* Status label */}
      <div className="absolute top-0 inset-x-0 z-30 flex justify-center pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className={`text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border shadow-sm ${
              serverBlocked
                ? 'bg-red-50 text-red-500 border-red-200'
                : phase === 6 || phase === 13
                  ? 'bg-green-50 text-green-600 border-green-200'
                  : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {LABELS[phase]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dotted travel path */}
      <div className="absolute top-1/2 -translate-y-3" style={{ left: '15%', right: '15%' }}>
        <div className="w-full border-t-2 border-dashed border-slate-200" />
      </div>

      {/* You (Alice) */}
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-8 flex flex-col items-center gap-1.5"
        style={{ left: '15%' }}
      >
        <div className="relative">
          <motion.div
            className="w-14 h-14 rounded-full flex items-center justify-center border-2"
            animate={{
              backgroundColor: phase === 13 ? '#dcfce7' : '#dbeafe',
              borderColor:     phase === 13 ? '#86efac' : '#bfdbfe',
              scale: aliceKeyActive ? [1, 1.12, 1] : 1,
            }}
            transition={{ duration: 0.45 }}
          >
            <UsersIcon className="w-7 h-7 text-blue-600" />
          </motion.div>
          <motion.div
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white shadow-md"
            animate={{
              scale:  aliceKeyActive ? [1, 1.6, 1] : 1,
              rotate: aliceKeyActive ? (phase === 1 ? [0, -35, 0] : [0, 35, 0]) : 0,
            }}
            transition={{ duration: 0.5 }}
          >
            <KeyIcon className="w-3 h-3 text-amber-900" />
          </motion.div>
        </div>
        <span className="text-xs font-bold text-slate-400">You</span>
        <div className="h-4">
          <AnimatePresence>
            {phase === 13 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="text-[10px] font-bold text-green-500"
              >
                ✓ Reply in!
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Server (center) */}
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-8 flex flex-col items-center gap-1.5"
        style={{ left: '50%' }}
      >
        <div className="relative">
          <motion.div
            className="w-14 h-14 rounded-xl flex items-center justify-center border-2"
            animate={{
              backgroundColor: serverBlocked
                ? ['#f8fafc', '#fef2f2', '#f8fafc', '#fef2f2', '#f8fafc']
                : '#f8fafc',
              borderColor: serverBlocked
                ? ['#e2e8f0', '#fca5a5', '#e2e8f0', '#fca5a5', '#e2e8f0']
                : '#e2e8f0',
            }}
            transition={{ duration: 0.9 }}
          >
            <HardDrivesIcon className="w-7 h-7 text-slate-400" />
          </motion.div>
          <AnimatePresence>
            {serverBlocked && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg"
              >
                ✕
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className="text-xs font-bold text-slate-400">Server</span>
        <div className="h-4">
          <AnimatePresence>
            {serverBlocked && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] font-bold text-red-400 uppercase tracking-wide"
              >
                Encrypted
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Friend (Bob) */}
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-8 flex flex-col items-center gap-1.5"
        style={{ left: '85%' }}
      >
        <div className="relative">
          <motion.div
            className="w-14 h-14 rounded-full flex items-center justify-center border-2"
            animate={{
              backgroundColor: phase === 6 || phase === 7 ? '#dcfce7' : '#f0fdf4',
              borderColor:     phase === 6 || phase === 7 ? '#86efac' : '#bbf7d0',
              scale: bobKeyActive ? [1, 1.12, 1] : 1,
            }}
            transition={{ duration: 0.45 }}
          >
            <UsersIcon className="w-7 h-7 text-green-600" />
          </motion.div>
          <motion.div
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white shadow-md"
            animate={{
              scale:  bobKeyActive ? [1, 1.6, 1] : 1,
              rotate: bobKeyActive ? (phase === 5 ? [0, 35, 0] : [0, -35, 0]) : 0,
            }}
            transition={{ duration: 0.5 }}
          >
            <KeyIcon className="w-3 h-3 text-amber-900" />
          </motion.div>
        </div>
        <span className="text-xs font-bold text-slate-400">Friend</span>
        <div className="h-4">
          <AnimatePresence>
            {phase === 6 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="text-[10px] font-bold text-green-500"
              >
                ✓ Unlocked
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Traveling message */}
      <motion.div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-3 z-20"
        animate={{ left: msgLeft }}
        transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
      >
        <AnimatePresence mode="wait">
          {isSealed ? (
            <motion.div
              key="sealed"
              initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.6, rotate: 12 }}
              transition={{ duration: 0.3 }}
              className="w-12 h-10 bg-slate-800 border-2 border-slate-600 rounded-lg flex items-center justify-center shadow-lg"
            >
              <LockIcon className="w-5 h-5 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key={isReply ? 'open-reply' : 'open-msg'}
              initial={{ opacity: 0, scale: 0.6, rotate: 12 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.6, rotate: -12 }}
              transition={{ duration: 0.3 }}
              className={`w-12 h-10 border-2 rounded-lg flex flex-col items-center justify-center shadow-md gap-1 px-2 ${
                isReply
                  ? 'bg-green-50 border-green-300'
                  : 'bg-white border-blue-300'
              }`}
            >
              <div className={`w-full h-0.5 rounded-full ${isReply ? 'bg-green-300' : 'bg-blue-300'}`} />
              <div className={`w-full h-0.5 rounded-full ${isReply ? 'bg-green-200' : 'bg-blue-200'}`} />
              <div className={`w-3/4 h-0.5 rounded-full ${isReply ? 'bg-green-100' : 'bg-blue-100'}`} />
            </motion.div>
          )}
        </AnimatePresence>
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
              <KeyIcon className="w-6 h-6 text-slate-400" />
            ) : (
              <LockIcon className="w-6 h-6 text-slate-400" />
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
        <LockIcon className="w-5 h-5 text-white" />
      </motion.div>

      {/* Level 1 Nodes */}
      <motion.div className="absolute top-[45%] left-[25%] -translate-x-1/2 w-10 h-10 rounded-full border-2 border-slate-600 bg-slate-800 z-10" />
      <motion.div
        className="absolute top-[45%] left-[75%] -translate-x-1/2 w-10 h-10 rounded-full border-2 border-slate-600 bg-slate-800 z-10"
        animate={{ borderColor: ['#475569', '#ef4444', '#475569'] }}
        transition={{ duration: 4, repeat: Infinity, repeatDelay: 2, delay: 1 }}
      />

      {/* Level 2 Nodes (UsersIcon) */}
      <div className="absolute top-[75%] left-[12%] -translate-x-1/2 flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
          <UsersIcon className="w-5 h-5 text-slate-400" />
        </div>
        <span className="text-xs text-slate-500 mt-2">U1</span>
      </div>
      <div className="absolute top-[75%] left-[38%] -translate-x-1/2 flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
          <UsersIcon className="w-5 h-5 text-slate-400" />
        </div>
        <span className="text-xs text-slate-500 mt-2">U2</span>
      </div>
      <div className="absolute top-[75%] left-[62%] -translate-x-1/2 flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
          <UsersIcon className="w-5 h-5 text-slate-400" />
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
          <ArrowClockwiseIcon className="w-5 h-5 text-white" />
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
  // 0=visible, 1=get-token, 2=ghost-out, 3=in-transit, 4=at-server, 5=forwarding, 6=delivered
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const DURATIONS = [1820, 1170, 910, 1110, 2080, 1110, 1950];
    const ids: ReturnType<typeof setTimeout>[] = [];

    const cycle = () => {
      let t = 0;
      DURATIONS.forEach((d, i) => {
        ids.push(setTimeout(() => setPhase(i), t));
        t += d;
      });
      ids.push(setTimeout(cycle, t));
    };

    cycle();
    return () => ids.forEach(clearTimeout);
  }, []);

  const LABELS = [
    'Ready to send…',
    'Getting a one-time token…',
    'Hiding your identity…',
    'Sending anonymously…',
    'Server: who sent this?',
    'Forwarding…',
    'Delivered — you stayed hidden!',
  ];

  const isGhost = phase >= 2 && phase <= 5;
  const msgLeft = phase <= 2 ? '15%' : phase <= 4 ? '50%' : '85%';
  const msgVisible = phase >= 2;

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-gradient-to-b from-purple-50/40 to-white">
      {/* Status label */}
      <div className="absolute top-0 inset-x-0 z-30 flex justify-center pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className={`text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border shadow-sm ${
              phase === 4
                ? 'bg-purple-50 text-purple-600 border-purple-200'
                : phase === 6
                  ? 'bg-green-50 text-green-600 border-green-200'
                  : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {LABELS[phase]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dotted travel path */}
      <div className="absolute top-1/2 -translate-y-3" style={{ left: '15%', right: '15%' }}>
        <div className="w-full border-t-2 border-dashed border-purple-100" />
      </div>

      {/* You (sender — can ghost out) */}
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-8 flex flex-col items-center gap-1.5"
        style={{ left: '15%' }}
      >
        <div className="relative">
          <motion.div
            className="w-14 h-14 rounded-full flex items-center justify-center border-2"
            animate={{
              opacity: isGhost ? 0.28 : 1,
              backgroundColor: isGhost ? '#faf5ff' : '#ede9fe',
              borderColor: isGhost ? '#e9d5ff' : '#c4b5fd',
              scale: phase === 2 ? [1, 0.88, 1] : 1,
              filter: isGhost ? 'blur(1.5px)' : 'blur(0px)',
            }}
            transition={{ duration: 0.65 }}
          >
            <AnimatePresence mode="wait">
              {isGhost ? (
                <motion.div
                  key="ghost"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.3 }}
                >
                  <GhostIcon className="w-7 h-7 text-purple-300" />
                </motion.div>
              ) : (
                <motion.div
                  key="user"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.3 }}
                >
                  <UsersIcon className="w-7 h-7 text-purple-600" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Token badge — appears when fetching token */}
          <AnimatePresence>
            {(phase === 1 || phase === 2) && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white shadow-md"
              >
                <KeyIcon className="w-3 h-3 text-amber-900" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className="text-xs font-bold text-slate-400">You</span>
        <div className="h-4">
          <AnimatePresence>
            {isGhost && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] font-bold text-purple-400 uppercase tracking-wide"
              >
                Anonymous
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Server */}
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-8 flex flex-col items-center gap-1.5"
        style={{ left: '50%' }}
      >
        <div className="relative">
          <motion.div
            className="w-14 h-14 rounded-xl flex items-center justify-center border-2"
            animate={{
              backgroundColor:
                phase === 4 ? ['#f8fafc', '#faf5ff', '#f8fafc'] : '#f8fafc',
              borderColor:
                phase === 4 ? ['#e2e8f0', '#e9d5ff', '#e2e8f0'] : '#e2e8f0',
            }}
            transition={{ duration: 0.8 }}
          >
            <HardDrivesIcon className="w-7 h-7 text-slate-400" />
          </motion.div>

          {/* sender: null popup */}
          <AnimatePresence>
            {phase === 4 && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.9 }}
                transition={{ duration: 0.25 }}
                className="absolute -top-11 left-1/2 -translate-x-1/2 font-mono text-[11px] bg-slate-900 text-white px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap"
              >
                sender:{' '}
                <span className="text-purple-400 font-bold italic">null</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className="text-xs font-bold text-slate-400">Server</span>
        <div className="h-4">
          <AnimatePresence>
            {phase === 4 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] font-bold text-purple-400 uppercase tracking-wide"
              >
                No idea who
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Friend (recipient) */}
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-8 flex flex-col items-center gap-1.5"
        style={{ left: '85%' }}
      >
        <motion.div
          className="w-14 h-14 rounded-full flex items-center justify-center border-2"
          animate={{
            backgroundColor: phase === 6 ? '#dcfce7' : '#f0fdf4',
            borderColor: phase === 6 ? '#86efac' : '#bbf7d0',
            scale: phase === 6 ? [1, 1.12, 1] : 1,
          }}
          transition={{ duration: 0.45 }}
        >
          <UsersIcon className="w-7 h-7 text-green-600" />
        </motion.div>
        <span className="text-xs font-bold text-slate-400">Friend</span>
        <div className="h-4">
          <AnimatePresence>
            {phase === 6 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="text-[10px] font-bold text-green-500"
              >
                ✓ Received
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Traveling message with token tag */}
      <motion.div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-3 z-20"
        animate={{
          left: msgLeft,
          opacity: msgVisible ? 1 : 0,
          scale: msgVisible ? 1 : 0.4,
        }}
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="relative">
          {/* Sealed box — purple-themed for ghost section */}
          <div className="w-12 h-10 bg-purple-900 border-2 border-purple-700 rounded-lg flex items-center justify-center shadow-lg">
            <LockIcon className="w-5 h-5 text-white" />
          </div>
          {/* Token tag attached to the box */}
          <motion.div
            className="absolute -bottom-2.5 -right-2.5 bg-amber-400 text-amber-900 font-mono font-bold rounded shadow-md border border-amber-500 px-1.5 py-0.5"
            style={{ fontSize: '8px' }}
            animate={{ opacity: phase <= 5 ? 1 : 0.4 }}
            transition={{ duration: 0.3 }}
          >
            token
          </motion.div>
        </div>
      </motion.div>
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
