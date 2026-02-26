'use client';

import {
  ArrowClockwiseIcon,
  KeyIcon,
  LockIcon,
  UsersIcon,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function NerdTreeDemo() {
  // Tree structure (4-leaf left-balanced binary tree):
  //           Root  ← shared group secret
  //          /    \
  //         A      B   ← intermediate key nodes
  //        / \    / \
  //       U1 U2  U3 U4 ← members (U4 initiates key update)
  //
  // Phases: idle → U4 initiates → path U4→B → path B→Root
  //       → new epoch → propagate down → O(log N) badge → rest
  const [phase, setPhase] = useState(0);
  const [epoch, setEpoch] = useState(1);

  useEffect(() => {
    const DURATIONS = [2200, 800, 950, 950, 1100, 1400, 1800, 800];
    const ids: ReturnType<typeof setTimeout>[] = [];

    const cycle = () => {
      let t = 0;
      DURATIONS.forEach((d, i) => {
        ids.push(setTimeout(() => setPhase(i), t));
        t += d;
      });
      // Advance epoch just before phase 4 renders
      const epochAt = DURATIONS.slice(0, 3).reduce((a, b) => a + b, 0) - 50;
      ids.push(setTimeout(() => setEpoch((e) => e + 1), epochAt));
      ids.push(setTimeout(cycle, t));
    };

    cycle();
    return () => ids.forEach(clearTimeout);
  }, []);

  const LABELS = [
    'Ratchet tree at rest — all members hold root key',
    'U4 initiates key update — new path secret generated',
    'Path secret encrypted & sent: U4 → Node B',
    'Path secret encrypted & sent: Node B → Root',
    'New group key derived — epoch advanced',
    'New epoch key distributed to all members',
    'Forward secrecy: O(log₂ 4) = 2 encryptions',
    'Group re-secured',
  ];

  // ── SVG uses a fixed 400 × 500 coordinate space ──────────────────────────
  // HTML node % positions are derived from these coordinates.
  const X = { root: 200, A: 100, B: 300, U1: 48, U2: 152, U3: 248, U4: 352 };
  const Y = { root: 115, mid: 270, leaf: 410 };

  // Derived phase flags
  const u4Active = phase >= 1 && phase <= 3;
  const edgeU4toB = phase >= 2 && phase <= 4;
  const edgeBtoRoot = phase >= 3 && phase <= 4;
  const rootNew = phase >= 4 && phase <= 6;
  const spreading = phase >= 5 && phase <= 6;
  const showBadge = phase === 6;

  // Base tree edges (path strings matching SVG coords)
  const BASE_EDGES = [
    `M ${X.root} ${Y.root} L ${X.A} ${Y.mid}`,
    `M ${X.root} ${Y.root} L ${X.B} ${Y.mid}`,
    `M ${X.A} ${Y.mid} L ${X.U1} ${Y.leaf}`,
    `M ${X.A} ${Y.mid} L ${X.U2} ${Y.leaf}`,
    `M ${X.B} ${Y.mid} L ${X.U3} ${Y.leaf}`,
    `M ${X.B} ${Y.mid} L ${X.U4} ${Y.leaf}`,
  ];

  // Propagation edges (Root → leaves, staggered delays)
  const SPREAD_EDGES = [
    { d: `M ${X.root} ${Y.root} L ${X.A} ${Y.mid}`, delay: 0 },
    { d: `M ${X.root} ${Y.root} L ${X.B} ${Y.mid}`, delay: 0.1 },
    { d: `M ${X.A} ${Y.mid} L ${X.U1} ${Y.leaf}`, delay: 0.3 },
    { d: `M ${X.A} ${Y.mid} L ${X.U2} ${Y.leaf}`, delay: 0.4 },
    { d: `M ${X.B} ${Y.mid} L ${X.U3} ${Y.leaf}`, delay: 0.3 },
    { d: `M ${X.B} ${Y.mid} L ${X.U4} ${Y.leaf}`, delay: 0.4 },
  ];

  return (
    <div className="relative w-full h-full select-none">
      {/* Status label */}
      <div className="absolute top-0 inset-x-0 z-30 flex justify-center pt-3 px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border text-center ${
              phase >= 1 && phase <= 3
                ? 'bg-blue-950/80 text-blue-400 border-blue-800'
                : phase === 4 || phase === 5
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                  : phase === 6
                    ? 'bg-slate-800 text-slate-300 border-slate-600'
                    : 'bg-slate-800/70 text-slate-500 border-slate-700'
            }`}
          >
            {LABELS[phase]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── SVG layer — edges and traveling signals ───────────────────────── */}
      <svg
        viewBox="0 0 400 500"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <filter id="nerdGlow">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base edges — draw in on mount */}
        {BASE_EDGES.map((d, i) => (
          <motion.path
            key={d}
            d={d}
            stroke="#334155"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              pathLength: { duration: 0.55, delay: 0.15 + i * 0.08 },
              opacity: { duration: 0.25, delay: 0.15 + i * 0.08 },
            }}
          />
        ))}

        {/* Update path highlight — U4 → B (blue, phase 2+) */}
        <motion.path
          d={`M ${X.U4} ${Y.leaf} L ${X.B} ${Y.mid}`}
          stroke="#3b82f6"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          filter="url(#nerdGlow)"
          animate={{
            pathLength: edgeU4toB ? 1 : 0,
            opacity: edgeU4toB ? 0.9 : 0,
          }}
          transition={{
            pathLength: { duration: edgeU4toB ? 0.7 : 0.02, ease: 'easeInOut' },
            opacity: { duration: 0.25 },
          }}
        />

        {/* Update path highlight — B → Root (blue, phase 3+) */}
        <motion.path
          d={`M ${X.B} ${Y.mid} L ${X.root} ${Y.root}`}
          stroke="#3b82f6"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          filter="url(#nerdGlow)"
          animate={{
            pathLength: edgeBtoRoot ? 1 : 0,
            opacity: edgeBtoRoot ? 0.9 : 0,
          }}
          transition={{
            pathLength: {
              duration: edgeBtoRoot ? 0.7 : 0.02,
              ease: 'easeInOut',
            },
            opacity: { duration: 0.25 },
          }}
        />

        {/* Propagation edges — Root → all leaves (green, phase 5+) */}
        {SPREAD_EDGES.map((e) => (
          <motion.path
            key={e.d}
            d={e.d}
            stroke="#22c55e"
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            filter="url(#nerdGlow)"
            animate={{
              pathLength: spreading ? 1 : 0,
              opacity: spreading ? 0.85 : 0,
            }}
            transition={{
              pathLength: {
                duration: spreading ? 0.55 : 0.02,
                delay: spreading ? e.delay : 0,
                ease: 'easeInOut',
              },
              opacity: {
                duration: 0.2,
                delay: spreading ? e.delay : 0,
              },
            }}
          />
        ))}

        {/* Signal dot — U4 → B (phase 2) */}
        {phase === 2 && (
          <motion.circle
            r={7}
            fill="#3b82f6"
            filter="url(#nerdGlow)"
            initial={{ cx: X.U4, cy: Y.leaf, opacity: 0 }}
            animate={{
              cx: X.B,
              cy: Y.mid,
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 0.8,
              times: [0, 0.08, 0.88, 1],
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Signal dot — B → Root (phase 3) */}
        {phase === 3 && (
          <motion.circle
            r={7}
            fill="#3b82f6"
            filter="url(#nerdGlow)"
            initial={{ cx: X.B, cy: Y.mid, opacity: 0 }}
            animate={{
              cx: X.root,
              cy: Y.root,
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 0.8,
              times: [0, 0.08, 0.88, 1],
              ease: 'easeInOut',
            }}
          />
        )}
      </svg>

      {/* ── HTML node overlays ─────────────────────────────────────────────── */}

      {/* Root */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
        style={{ left: '50%', top: '23%' }}
      >
        <motion.div
          className="w-14 h-14 rounded-full flex flex-col items-center justify-center border-2"
          animate={{
            backgroundColor: rootNew ? '#052e16' : '#0f172a',
            borderColor: rootNew ? '#22c55e' : '#475569',
            boxShadow: rootNew
              ? '0 0 22px rgba(34,197,94,0.55)'
              : '0 0 0px transparent',
          }}
          transition={{ duration: 0.4 }}
        >
          <LockIcon
            className={`w-5 h-5 ${rootNew ? 'text-green-400' : 'text-slate-400'}`}
          />
          <AnimatePresence mode="wait">
            <motion.span
              key={epoch}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className={`text-[9px] font-mono font-bold leading-none mt-0.5 ${rootNew ? 'text-green-400' : 'text-slate-600'}`}
            >
              E{epoch}
            </motion.span>
          </AnimatePresence>
        </motion.div>
        <span className="text-[9px] font-mono text-slate-600 mt-1">Root</span>
      </div>

      {/* Node A */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
        style={{ left: '25%', top: '54%' }}
      >
        <motion.div
          className="w-10 h-10 rounded-full flex items-center justify-center border-2"
          animate={{
            backgroundColor: spreading ? '#052e16' : '#0f172a',
            borderColor: spreading ? '#22c55e' : '#334155',
            boxShadow: spreading ? '0 0 13px rgba(34,197,94,0.45)' : 'none',
          }}
          transition={{ duration: 0.3, delay: spreading ? 0.25 : 0 }}
        >
          <KeyIcon
            className={`w-4 h-4 ${spreading ? 'text-green-400' : 'text-slate-600'}`}
          />
        </motion.div>
        <span className="text-[9px] font-mono text-slate-600 mt-1">A</span>
      </div>

      {/* Node B */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
        style={{ left: '75%', top: '54%' }}
      >
        <motion.div
          className="w-10 h-10 rounded-full flex items-center justify-center border-2"
          animate={{
            backgroundColor:
              edgeU4toB || edgeBtoRoot
                ? '#1e1b4b'
                : spreading
                  ? '#052e16'
                  : '#0f172a',
            borderColor:
              edgeU4toB || edgeBtoRoot
                ? '#3b82f6'
                : spreading
                  ? '#22c55e'
                  : '#334155',
            boxShadow:
              edgeU4toB || edgeBtoRoot
                ? '0 0 16px rgba(59,130,246,0.55)'
                : spreading
                  ? '0 0 13px rgba(34,197,94,0.45)'
                  : 'none',
          }}
          transition={{ duration: 0.3 }}
        >
          <KeyIcon
            className={`w-4 h-4 ${
              edgeU4toB || edgeBtoRoot
                ? 'text-blue-400'
                : spreading
                  ? 'text-green-400'
                  : 'text-slate-600'
            }`}
          />
        </motion.div>
        <span className="text-[9px] font-mono text-slate-600 mt-1">B</span>
      </div>

      {/* U1, U2, U3 — stable members */}
      {(
        [
          { label: 'U1', left: '12%' },
          { label: 'U2', left: '38%' },
          { label: 'U3', left: '62%' },
        ] as const
      ).map(({ label, left }) => (
        <div
          key={label}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
          style={{ left, top: '82%' }}
        >
          <motion.div
            className="w-10 h-10 rounded-full flex items-center justify-center border-2"
            animate={{
              backgroundColor: spreading ? '#052e16' : '#1e293b',
              borderColor: spreading ? '#22c55e' : '#334155',
              boxShadow: spreading ? '0 0 12px rgba(34,197,94,0.4)' : 'none',
            }}
            transition={{ duration: 0.3, delay: spreading ? 0.45 : 0 }}
          >
            <UsersIcon
              className={`w-5 h-5 ${spreading ? 'text-green-400' : 'text-slate-500'}`}
            />
          </motion.div>
          <span className="text-[9px] font-mono text-slate-600 mt-1">
            {label}
          </span>
        </div>
      ))}

      {/* U4 — the updating member */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
        style={{ left: '88%', top: '82%' }}
      >
        <motion.div
          className="w-10 h-10 rounded-full flex items-center justify-center border-2"
          animate={{
            backgroundColor: u4Active
              ? '#1e1b4b'
              : spreading
                ? '#052e16'
                : '#1e293b',
            borderColor: u4Active
              ? '#3b82f6'
              : spreading
                ? '#22c55e'
                : '#334155',
            boxShadow: u4Active
              ? '0 0 18px rgba(59,130,246,0.6)'
              : spreading
                ? '0 0 12px rgba(34,197,94,0.4)'
                : 'none',
            scale: phase === 1 ? [1, 1.18, 1] : 1,
          }}
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="wait">
            {u4Active ? (
              <motion.div
                key="spin"
                initial={{ opacity: 0, rotate: -80 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 80 }}
                transition={{ duration: 0.25 }}
              >
                <ArrowClockwiseIcon className="w-5 h-5 text-blue-400" />
              </motion.div>
            ) : (
              <motion.div
                key="user"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <UsersIcon
                  className={`w-5 h-5 ${spreading ? 'text-green-400' : 'text-slate-500'}`}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* "Key Update" callout bubble */}
        <AnimatePresence>
          {phase === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-blue-300 bg-blue-950/80 border border-blue-800 rounded px-2 py-0.5 whitespace-nowrap z-20"
            >
              Key Update
            </motion.div>
          )}
        </AnimatePresence>

        <motion.span
          animate={{ color: u4Active ? '#93c5fd' : '#475569' }}
          transition={{ duration: 0.25 }}
          className="text-[9px] font-mono mt-1 font-bold"
        >
          U4
        </motion.span>
      </div>

      {/* O(log N) efficiency badge */}
      <AnimatePresence>
        {showBadge && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 font-mono text-[10px] font-bold text-green-400 bg-green-950/80 border border-green-800 rounded-lg px-3 py-1.5 whitespace-nowrap"
          >
            O(log₂ N) · 2 encryptions for 4 members
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
