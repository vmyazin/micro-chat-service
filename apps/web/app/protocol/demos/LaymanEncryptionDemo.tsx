'use client';

import {
  HardDrivesIcon,
  KeyIcon,
  LockIcon,
  UsersIcon,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function LaymanEncryptionDemo() {
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
    'Writing a message…', // 0
    'Sealing the box…', // 1
    'In transit…', // 2
    "Server can't read it", // 3
    'Forwarding…', // 4
    'Opening the box…', // 5
    'Message delivered!', // 6
    'Friend is replying…', // 7
    'Sealing the box…', // 8
    'In transit…', // 9
    "Server can't read it", // 10
    'Forwarding…', // 11
    'Opening the reply…', // 12
    'Reply received!', // 13
  ];

  // Message x-position: forward travels left→center→right, reverse goes right→center→left
  const msgLeft =
    phase <= 1
      ? '15%'
      : phase <= 3
        ? '50%'
        : phase <= 8
          ? '85%'
          : phase <= 10
            ? '50%'
            : '15%';

  const isSealed = (phase >= 1 && phase <= 5) || (phase >= 8 && phase <= 12);
  const serverBlocked = phase === 3 || phase === 10;
  const isReply = phase >= 7; // green-tinted message on the return trip

  // Key pulse: which side is locking/unlocking this phase
  const aliceKeyActive = phase === 1 || phase === 12;
  const bobKeyActive = phase === 5 || phase === 8;

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
      <div
        className="absolute top-1/2 -translate-y-3"
        style={{ left: '15%', right: '15%' }}
      >
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
              borderColor: phase === 13 ? '#86efac' : '#bfdbfe',
              scale: aliceKeyActive ? [1, 1.12, 1] : 1,
            }}
            transition={{ duration: 0.45 }}
          >
            <UsersIcon className="w-7 h-7 text-blue-600" />
          </motion.div>
          <motion.div
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white shadow-md"
            animate={{
              scale: aliceKeyActive ? [1, 1.6, 1] : 1,
              rotate: aliceKeyActive
                ? phase === 1
                  ? [0, -35, 0]
                  : [0, 35, 0]
                : 0,
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
              backgroundColor:
                phase === 6 || phase === 7 ? '#dcfce7' : '#f0fdf4',
              borderColor: phase === 6 || phase === 7 ? '#86efac' : '#bbf7d0',
              scale: bobKeyActive ? [1, 1.12, 1] : 1,
            }}
            transition={{ duration: 0.45 }}
          >
            <UsersIcon className="w-7 h-7 text-green-600" />
          </motion.div>
          <motion.div
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white shadow-md"
            animate={{
              scale: bobKeyActive ? [1, 1.6, 1] : 1,
              rotate: bobKeyActive
                ? phase === 5
                  ? [0, 35, 0]
                  : [0, -35, 0]
                : 0,
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
              <div
                className={`w-full h-0.5 rounded-full ${isReply ? 'bg-green-300' : 'bg-blue-300'}`}
              />
              <div
                className={`w-full h-0.5 rounded-full ${isReply ? 'bg-green-200' : 'bg-blue-200'}`}
              />
              <div
                className={`w-3/4 h-0.5 rounded-full ${isReply ? 'bg-green-100' : 'bg-blue-100'}`}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
