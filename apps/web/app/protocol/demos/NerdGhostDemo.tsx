'use client';

import { HardDrivesIcon, LockIcon, UsersIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// Code annotation content per phase — rendered inside the shared dark pill
function CodeAnnotation({ phase }: { phase: number }) {
  if (phase === 1)
    return (
      <>
        <span className="text-green-400">GET</span>
        <span className="text-slate-300"> /api/tokens</span>
      </>
    );

  if (phase === 2)
    return (
      <>
        <span className="text-purple-400">token:</span>{' '}
        <span className="text-amber-300">"0x8f4a…2bc9"</span>
        <br />
        <span className="text-slate-500">stored: </span>
        <span className="text-slate-400">SHA256(token)</span>
      </>
    );

  if (phase === 3)
    return (
      <>
        <span className="text-slate-500">{'{ '}</span>
        <span className="text-blue-400">sender_id</span>
        <span className="text-slate-500">: </span>
        <span className="text-purple-400 italic">null</span>
        <span className="text-slate-500">, </span>
        <span className="text-blue-400">token</span>
        <span className="text-slate-500">: </span>
        <span className="text-amber-300">"…"</span>
        <span className="text-slate-500">, </span>
        <span className="text-blue-400">payload</span>
        <span className="text-slate-500">: </span>
        <span className="text-green-400">"AES-GCM…"</span>
        <span className="text-slate-500">{' }'}</span>
      </>
    );

  if (phase === 5)
    return (
      <>
        <span className="text-slate-400">db.lookup(</span>
        <span className="text-amber-300">SHA256</span>
        <span className="text-slate-400">(token))</span>
        <br />
        <motion.span
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 0.9, repeat: Infinity }}
          className="text-slate-500"
        >
          → searching…
        </motion.span>
      </>
    );

  // phases 6 and 7 share the resolved result
  if (phase >= 6)
    return (
      <>
        <span className="text-slate-500">{'→ { '}</span>
        <span className="text-blue-400">hash</span>
        <span className="text-slate-500">: </span>
        <span className="text-slate-300">"a3f9…"</span>
        <span className="text-slate-500">, </span>
        <span className="text-blue-400">sender</span>
        <span className="text-slate-500">: </span>
        <span className="text-purple-400 italic font-bold">null</span>
        <span className="text-slate-500">{' }'}</span>
      </>
    );

  return null;
}

export function NerdGhostDemo() {
  // Phases:
  // 0 idle          — three nodes at rest
  // 1 GET /tokens   — client requests a token from server
  // 2 token issued  — server returns token; client stores it
  // 3 msg sealed    — message built with sender_id: null
  // 4 dispatching   — sealed box travels client → server
  // 5 hash lookup   — server hashes token, queries DB
  // 6 null result   — sender: null confirmed
  // 7 delivered     — message forwarded to group
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const T = 1.8; // speed coefficient — increase to slow down
    const DURATIONS = [1600, 1000, 1400, 1000, 1000, 1800, 1200, 1800].map(
      (d) => d * T,
    );
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
    'Sealed sender — identity decoupled from routing',
    'Client requests a one-time delivery token',
    'Token issued — server stores SHA-256(token) only',
    'Message sealed — sender_id stripped from envelope',
    'Dispatching anonymously to delivery server',
    'Server hashes token — looking up sender identity…',
    'sender: null — server cannot identify origin',
    'Delivered anonymously ✓',
  ];

  // Derived flags
  const clientActive  = phase >= 1 && phase <= 3;
  const serverActive  = phase === 5 || phase === 6;
  const groupActive   = phase === 7;
  const showTokenChip = phase >= 2 && phase <= 3;
  const showNullBadge = phase >= 6;
  const msgVisible    = phase >= 3;
  const msgLeft       = phase <= 3 ? '15%' : phase <= 6 ? '50%' : '85%';

  // Annotation shown for these phases; 6 and 7 share key "6" so it doesn't re-enter
  const hasAnnotation   = [1, 2, 3, 5, 6, 7].includes(phase);
  const annotationKey   = phase >= 6 ? 6 : phase;

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-gradient-to-b from-purple-50/60 to-white/80">
      {/* Status banner */}
      <div className="absolute top-0 inset-x-0 z-30 flex justify-center pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border shadow-sm ${
              phase === 5
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : phase === 6
                  ? 'bg-purple-50 text-purple-600 border-purple-200'
                  : phase === 7
                    ? 'bg-green-50 text-green-600 border-green-200'
                    : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {LABELS[phase]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Code annotation zone — floats above the node row */}
      <div className="absolute inset-x-0 z-20 flex justify-center" style={{ top: '18%' }}>
        <AnimatePresence mode="wait">
          {hasAnnotation && (
            <motion.div
              key={annotationKey}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="font-mono text-[18px] bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl whitespace-nowrap leading-relaxed"
            >
              <CodeAnnotation phase={phase} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dotted travel path */}
      <div className="absolute top-1/2 -translate-y-3" style={{ left: '15%', right: '15%' }}>
        <div className="w-full border-t-2 border-dashed border-purple-200" />
      </div>

      {/* ── Nodes ────────────────────────────────────────────────────────── */}

      {/* Client */}
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-8 flex flex-col items-center gap-1.5"
        style={{ left: '15%' }}
      >
        <div className="relative">
          <motion.div
            className="w-14 h-14 rounded-full flex items-center justify-center border-2"
            animate={{
              backgroundColor: clientActive ? '#ede9fe' : '#f5f3ff',
              borderColor:     clientActive ? '#a78bfa' : '#ddd6fe',
              scale: phase === 1 ? [1, 1.1, 1] : 1,
            }}
            transition={{ duration: 0.4 }}
          >
            <UsersIcon className={`w-7 h-7 ${clientActive ? 'text-purple-600' : 'text-purple-300'}`} />
          </motion.div>

          {/* Token chip badge — appears after token is received */}
          <AnimatePresence>
            {showTokenChip && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-900 font-mono font-bold text-[8px] rounded px-1 py-0.5 shadow-md border border-amber-300 whitespace-nowrap"
              >
                tok
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className="text-xs font-bold text-slate-400">Client</span>
        <div className="h-4" />
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
              backgroundColor: serverActive
                ? ['#f5f3ff', '#ede9fe', '#f5f3ff']
                : '#f8fafc',
              borderColor: serverActive
                ? ['#ddd6fe', '#a78bfa', '#ddd6fe']
                : '#e2e8f0',
            }}
            transition={{ duration: 0.9 }}
          >
            <HardDrivesIcon className={`w-7 h-7 ${serverActive ? 'text-purple-400' : 'text-slate-400'}`} />
          </motion.div>

          {/* ø badge when null identity confirmed */}
          <AnimatePresence>
            {showNullBadge && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-purple-100 border-2 border-purple-300 rounded-full flex items-center justify-center text-purple-600 text-[10px] font-black shadow"
              >
                ø
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className="text-xs font-bold text-slate-400">Server</span>
        <div className="h-4">
          <AnimatePresence>
            {showNullBadge && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] font-bold text-purple-400 uppercase tracking-wide whitespace-nowrap"
              >
                sender: null
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Group (recipients) */}
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-8 flex flex-col items-center gap-1.5"
        style={{ left: '85%' }}
      >
        <motion.div
          className="w-14 h-14 rounded-full flex items-center justify-center border-2"
          animate={{
            backgroundColor: groupActive ? '#dcfce7' : '#f0fdf4',
            borderColor:     groupActive ? '#86efac' : '#bbf7d0',
            scale: groupActive ? [1, 1.1, 1] : 1,
          }}
          transition={{ duration: 0.45 }}
        >
          <UsersIcon className={`w-7 h-7 ${groupActive ? 'text-green-600' : 'text-green-300'}`} />
        </motion.div>
        <span className="text-xs font-bold text-slate-400">Group</span>
        <div className="h-4">
          <AnimatePresence>
            {groupActive && (
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

      {/* ── Traveling elements ───────────────────────────────────────────── */}

      {/* GET /tokens request dot: Client → Server (phase 1) */}
      {phase === 1 && (
        <motion.div
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
          style={{ top: 'calc(50% - 14px)' }}
          initial={{ left: '15%' }}
          animate={{ left: '50%' }}
          transition={{ duration: 0.85, ease: 'easeInOut' }}
        >
          <div className="w-2 h-2 rounded-full bg-purple-400 shadow-sm" />
        </motion.div>
      )}

      {/* Token traveling: Server → Client (phase 2) */}
      {phase === 2 && (
        <motion.div
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
          style={{ top: 'calc(50% - 14px)' }}
          initial={{ left: '50%' }}
          animate={{ left: '15%' }}
          transition={{ duration: 0.85, ease: 'easeInOut' }}
        >
          <div className="bg-amber-400 text-amber-900 font-mono font-bold text-[8px] rounded px-1 py-0.5 border border-amber-300 whitespace-nowrap shadow">
            token
          </div>
        </motion.div>
      )}

      {/* Sealed message box (phases 3–7) */}
      <motion.div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-3 z-20"
        animate={{
          left: msgLeft,
          opacity: msgVisible ? 1 : 0,
          scale: msgVisible ? 1 : 0.4,
        }}
        transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="relative">
          <div className="w-12 h-10 bg-purple-900 border-2 border-purple-700 rounded-lg flex items-center justify-center shadow-lg">
            <LockIcon className="w-5 h-5 text-white" />
          </div>

          {/* Token tag on the message */}
          <motion.div
            className="absolute -bottom-2.5 -right-2.5 bg-amber-400 text-amber-900 font-mono font-bold rounded shadow-md border border-amber-500 px-1.5 py-0.5"
            style={{ fontSize: '8px' }}
            animate={{ opacity: phase <= 6 ? 1 : 0.3 }}
            transition={{ duration: 0.3 }}
          >
            token
          </motion.div>

          {/* sender: null label above the box */}
          <AnimatePresence>
            {phase >= 3 && phase <= 6 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[8px] bg-slate-900 text-purple-400 px-1.5 py-0.5 rounded whitespace-nowrap"
              >
                sender: null
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
