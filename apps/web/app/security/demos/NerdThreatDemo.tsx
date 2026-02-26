'use client';

import {
  HardDrivesIcon,
  LockIcon,
  ShieldIcon,
  WarningIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// Phase map:
// 0        — idle
// 1-3      — Network Tap   (approach, intercept, blocked)
// 4-6      — Server Breach (approach, DB query,  blocked)
// 7-9      — Insider Threat(approach, meta query, blocked)
const T = 2; // speed coefficient — increase to slow down
const DURATIONS = [2400, 600, 1500, 1800, 600, 1500, 1800, 600, 1500, 1800].map(
  (d) => d * T,
);

const LABELS = [
  'Zero-trust — 3 adversary classes modeled',
  'Network tap — intercepting wire traffic',
  'Attacker reads packet: AES-GCM ciphertext only',
  'Blocked — no key material in transit',
  'Server breach — attacker reaches the database',
  'Querying stored message content…',
  'Blocked — zero server knowledge, plaintext never stored',
  'Rogue insider — querying delivery metadata',
  'Querying sender identity…',
  'Blocked — sender_id: null, sealed sender active',
];

// Code annotation rendered inside the shared dark pill
function ThreatAnnotation({ phase }: { phase: number }) {
  if (phase === 2)
    return (
      <>
        <span className="text-slate-400">read(wire) → </span>
        <span className="text-amber-300">"AES-GCM[0x3fa7…]"</span>
        <br />
        <span className="text-slate-500">key → </span>
        <span className="text-red-400 italic">undefined</span>
      </>
    );

  if (phase === 3)
    return (
      <>
        <span className="text-red-400">decrypt</span>
        <span className="text-slate-400">(key=null) → Error</span>
        <br />
        <span className="text-slate-600">{'// '}</span>
        <span className="text-green-400">ciphertext only in transit</span>
      </>
    );

  if (phase === 5)
    return (
      <>
        <span className="text-amber-300">SELECT</span>
        <span className="text-slate-400"> * </span>
        <span className="text-amber-300">FROM</span>
        <span className="text-slate-400"> messages</span>
        <br />
        <span className="text-slate-500">{'→ { payload: '}</span>
        <span className="text-green-400">&lt;blob&gt;</span>
        <span className="text-slate-500">{', sender: '}</span>
        <span className="text-purple-400 italic">null</span>
        <span className="text-slate-500">{' }'}</span>
      </>
    );

  if (phase === 6)
    return (
      <>
        <span className="text-blue-400">plaintext</span>
        <span className="text-slate-500">: </span>
        <span className="text-purple-400 italic">null</span>
        <br />
        <span className="text-slate-600">{'// '}</span>
        <span className="text-green-400">server blind — encrypted at rest</span>
      </>
    );

  if (phase === 8)
    return (
      <>
        <span className="text-slate-400">db.query(</span>
        <span className="text-blue-400">sender_id</span>
        <span className="text-slate-400">)</span>
        <br />
        <span className="text-slate-500">→ </span>
        <span className="text-purple-400 italic">NULL</span>
        <span className="text-slate-500"> · route: </span>
        <span className="text-amber-300">"anonymous"</span>
      </>
    );

  if (phase === 9)
    return (
      <>
        <span className="text-blue-400">sender_id</span>
        <span className="text-slate-500">: </span>
        <span className="text-purple-400 italic font-bold">NULL</span>
        <br />
        <span className="text-slate-600">{'// '}</span>
        <span className="text-green-400">
          sealed sender — identity never stored
        </span>
      </>
    );

  return null;
}

// Reusable attacker node
function AttackerNode({
  label,
  blocked,
  active,
}: {
  label: string;
  blocked: boolean;
  active: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        className="w-14 h-14 rounded-full flex items-center justify-center border-2"
        animate={{
          backgroundColor: blocked ? '#052e16' : '#2d0d0d',
          borderColor: blocked ? '#22c55e' : active ? '#ef4444' : '#7f1d1d',
          boxShadow: blocked
            ? '0 0 14px rgba(34,197,94,0.5)'
            : active
              ? '0 0 20px rgba(239,68,68,0.65)'
              : '0 0 8px rgba(239,68,68,0.25)',
        }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence mode="wait">
          {blocked ? (
            <motion.div
              key="blocked"
              initial={{ opacity: 0, rotate: -30 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <XCircleIcon className="w-7 h-7 text-green-400" />
            </motion.div>
          ) : (
            <motion.div
              key="threat"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                rotate: active ? [0, -8, 8, 0] : 0,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: active ? 0.6 : 0.2,
                repeat: active ? Infinity : 0,
              }}
            >
              <WarningIcon className="w-7 h-7 text-red-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <motion.span
        animate={{ color: blocked ? '#4ade80' : '#f87171' }}
        transition={{ duration: 0.25 }}
        className="text-[11px] font-mono font-bold uppercase tracking-wide"
      >
        {label}
      </motion.span>
    </div>
  );
}

export function NerdThreatDemo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
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

  // Derived flags — Network Tap
  const tapPhase = phase >= 1 && phase <= 3;
  const tapActive = phase === 2;
  const tapBlocked = phase === 3;

  // Derived flags — Server Breach
  const breachPhase = phase >= 4 && phase <= 6;
  const breachActive = phase === 5;
  const breachBlocked = phase === 6;

  // Derived flags — Insider Threat
  const insiderPhase = phase >= 7 && phase <= 9;
  const insiderActive = phase === 8;
  const insiderBlocked = phase === 9;

  const isBlocked = tapBlocked || breachBlocked || insiderBlocked;
  const serverUnderAttack = breachActive || insiderActive;
  const serverThreatened = breachPhase || insiderPhase;
  const wireAttacked = tapActive;

  // Status pill style
  const pillStyle = isBlocked
    ? 'bg-green-950/80 text-green-400 border-green-800'
    : phase === 0
      ? 'bg-slate-800/70 text-slate-500 border-slate-700'
      : phase % 3 === 1
        ? 'bg-amber-950/80 text-amber-400 border-amber-800'
        : 'bg-red-950/80 text-red-400 border-red-800';

  const hasAnnotation = [2, 3, 5, 6, 8, 9].includes(phase);

  return (
    <div className="relative w-full min-h-[500px] select-none overflow-hidden">
      {/* Status pill */}
      <div className="absolute top-0 inset-x-0 z-30 flex justify-center pt-4 px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className={`text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-full border text-center max-w-sm ${pillStyle}`}
          >
            {LABELS[phase]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Code annotation */}
      <div
        className="absolute inset-x-0 z-20 flex justify-center"
        style={{ top: '16%' }}
      >
        <AnimatePresence mode="wait">
          {hasAnnotation && (
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="font-mono text-sm bg-slate-950 border border-slate-700 text-white px-5 py-3 rounded-xl shadow-xl leading-relaxed"
            >
              <ThreatAnnotation phase={phase} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Wire ─────────────────────────────────────────────────────────────── */}
      <div
        className="absolute"
        style={{ top: 'calc(57% - 1px)', left: '22%', right: '22%' }}
      >
        <motion.div
          className="w-full border-t-2 border-dashed"
          animate={{
            borderColor: wireAttacked
              ? '#ef4444'
              : tapBlocked
                ? '#22c55e'
                : '#334155',
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* ── CLIENT node ──────────────────────────────────────────────────────── */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1"
        style={{ left: '22%', top: '57%' }}
      >
        <motion.div
          className="w-14 h-14 rounded-full flex items-center justify-center border-2"
          animate={{
            backgroundColor: tapPhase ? '#0c1f14' : '#0f172a',
            borderColor: tapPhase ? '#22c55e' : '#475569',
            boxShadow: tapPhase
              ? '0 0 18px rgba(34,197,94,0.4)'
              : '0 0 0px transparent',
          }}
          transition={{ duration: 0.35 }}
        >
          <ShieldIcon
            className={`w-7 h-7 ${tapPhase ? 'text-green-400' : 'text-slate-500'}`}
          />
        </motion.div>
        <span className="text-[11px] font-mono text-slate-600 uppercase tracking-wider">
          Client
        </span>
        <span className="text-[10px] font-mono text-slate-700">
          Keys · Decrypt
        </span>
      </div>

      {/* ── SERVER node ──────────────────────────────────────────────────────── */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1"
        style={{ left: '78%', top: '57%' }}
      >
        <motion.div
          className="w-14 h-14 rounded-xl flex items-center justify-center border-2"
          animate={{
            backgroundColor: serverUnderAttack ? '#2d0d0d' : '#0f172a',
            borderColor: serverUnderAttack
              ? '#ef4444'
              : serverThreatened && isBlocked
                ? '#22c55e'
                : '#475569',
            boxShadow: serverUnderAttack
              ? '0 0 24px rgba(239,68,68,0.55)'
              : '0 0 0px transparent',
          }}
          transition={{ duration: 0.35 }}
        >
          <HardDrivesIcon
            className={`w-7 h-7 ${
              serverUnderAttack
                ? 'text-red-400'
                : serverThreatened && isBlocked
                  ? 'text-green-400'
                  : 'text-slate-500'
            }`}
          />
        </motion.div>
        <span className="text-[11px] font-mono text-slate-600 uppercase tracking-wider">
          Server
        </span>
        <span className="text-[10px] font-mono text-slate-700">
          Zero Knowledge
        </span>
      </div>

      {/* ── Network Tap attacker (below wire) ────────────────────────────────── */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
        style={{ left: '50%', top: '78%' }}
      >
        <AnimatePresence>
          {tapPhase && (
            <motion.div
              initial={{ opacity: 0, scale: 0, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            >
              <AttackerNode
                label="Tap"
                blocked={tapBlocked}
                active={tapActive}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Server Breach attacker (below server) ────────────────────────────── */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
        style={{ left: '78%', top: '78%' }}
      >
        <AnimatePresence>
          {breachPhase && (
            <motion.div
              initial={{ opacity: 0, scale: 0, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            >
              <AttackerNode
                label="Attacker"
                blocked={breachBlocked}
                active={breachActive}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Insider Threat (same position, different label) ───────────────────── */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
        style={{ left: '78%', top: '78%' }}
      >
        <AnimatePresence>
          {insiderPhase && (
            <motion.div
              initial={{ opacity: 0, scale: 0, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            >
              <AttackerNode
                label="Insider"
                blocked={insiderBlocked}
                active={insiderActive}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Traveling encrypted packet ────────────────────────────────────────── */}
      <AnimatePresence>
        {phase >= 1 && (
          <motion.div
            key={`packet-${Math.floor(phase / 3)}`}
            className="absolute z-15 -translate-x-1/2 -translate-y-1/2"
            style={{ top: 'calc(57% - 3px)' }}
            initial={{ left: '22%', opacity: 0, scale: 0.7 }}
            animate={{ left: '78%', opacity: [0, 1, 1, 0.4], scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 2.2,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatDelay: 0.5,
            }}
          >
            <div className="w-9 h-8 bg-slate-800 border border-slate-600 rounded flex items-center justify-center shadow-lg">
              <LockIcon className="w-4 h-4 text-slate-400" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SVG connector lines (attacker → target) ──────────────────────────── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        {/* Tap → wire */}
        {tapActive && (
          <motion.line
            x1="50%"
            y1="71%"
            x2="50%"
            y2="57%"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        )}

        {/* Breach/Insider → server */}
        {(breachActive || insiderActive) && (
          <motion.line
            x1="78%"
            y1="71%"
            x2="78%"
            y2="64%"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        )}
      </svg>

      {/* ── BLOCKED / PASSED verdict badge ───────────────────────────────────── */}
      <AnimatePresence>
        {isBlocked && (
          <motion.div
            key={`verdict-${phase}`}
            initial={{ opacity: 0, y: 8, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 font-mono text-xs font-bold text-green-400 bg-green-950/80 border border-green-800 rounded-lg px-5 py-2 whitespace-nowrap"
          >
            {tapBlocked && '✓ E2E — key material never in transit'}
            {breachBlocked &&
              '✓ Zero knowledge — server stores only ciphertext'}
            {insiderBlocked &&
              '✓ Sealed sender — identity decoupled from routing'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
