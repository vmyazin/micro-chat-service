'use client';

import {
  GhostIcon,
  HardDrivesIcon,
  KeyIcon,
  LockIcon,
  UsersIcon,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function LaymanGhostDemo() {
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
      <div
        className="absolute top-1/2 -translate-y-3"
        style={{ left: '15%', right: '15%' }}
      >
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
