'use client';

import { KeyIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function LaymanRatchetDemo() {
  // 0=active, 1=message-sent, 2=overheat, 3=exploding, 4=smoke, 5=forming, 6=new-ready
  const [phase, setPhase] = useState(0);
  const [keyIndex, setKeyIndex] = useState(0);

  useEffect(() => {
    const T = 2.5; // speed coefficient — multiply to slow down, divide to speed up
    const DURATIONS = [1500, 450, 300, 700, 1200, 900, 600].map((d) => d * T);
    const ids: ReturnType<typeof setTimeout>[] = [];

    const cycle = () => {
      let t = 0;
      DURATIONS.forEach((d, i) => {
        ids.push(setTimeout(() => setPhase(i), t));
        t += d;
      });
      ids.push(
        setTimeout(() => {
          setKeyIndex((prev) => prev + 1);
          cycle();
        }, t),
      );
    };

    cycle();
    return () => ids.forEach(clearTimeout);
  }, []);

  const LABELS = [
    'This key encrypts the message',
    'Message sent',
    'Key: self-destruct initiated',
    'Exploding…',
    "Gone — can't be recovered",
    'Forging new key from fresh entropy…',
    'New key ready',
  ];

  const keyLabel = `K${keyIndex + 1}`;
  const nextKeyLabel = `K${keyIndex + 2}`;
  const showActiveKey = phase <= 2;
  const isOverheat = phase === 2;
  const isExploding = phase === 3;
  const isSmoke = phase === 4;
  const isForming = phase >= 5;

  // Sliding window: show at most 5 history slots
  const historyCount = Math.min(keyIndex + 1, 5);
  const startIdx = keyIndex - historyCount + 1;

  // 12 explosion particles in all directions
  const PARTICLES = [
    { dx: 0, dy: -58, color: 'bg-amber-400', size: 'w-2 h-2' },
    { dx: 41, dy: -41, color: 'bg-orange-400', size: 'w-1.5 h-1.5' },
    { dx: 58, dy: 0, color: 'bg-amber-500', size: 'w-2 h-2' },
    { dx: 41, dy: 41, color: 'bg-red-400', size: 'w-1.5 h-1.5' },
    { dx: 0, dy: 58, color: 'bg-orange-500', size: 'w-2 h-2' },
    { dx: -41, dy: 41, color: 'bg-amber-400', size: 'w-1.5 h-1.5' },
    { dx: -58, dy: 0, color: 'bg-orange-400', size: 'w-2 h-2' },
    { dx: -41, dy: -41, color: 'bg-red-300', size: 'w-1.5 h-1.5' },
    { dx: 22, dy: -54, color: 'bg-amber-300', size: 'w-1 h-1' },
    { dx: -22, dy: -54, color: 'bg-orange-300', size: 'w-1 h-1' },
    { dx: 54, dy: 22, color: 'bg-amber-500', size: 'w-1 h-1' },
    { dx: -54, dy: 22, color: 'bg-red-400', size: 'w-1 h-1' },
  ];

  return (
    <div
      className="relative w-full h-full select-none overflow-hidden flex flex-col items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(49,37,20,1) 0%, rgba(4,6,14,1) 60%)',
      }}
    >
      {/* Faint vault door — background decoration */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Outer rim */}
        <div className="absolute w-60 h-60 rounded-full border border-amber-400/8" />
        {/* Middle ring */}
        <div className="absolute w-48 h-48 rounded-full border border-amber-400/8" />
        {/* Inner ring — frames the key card */}
        <div className="absolute w-36 h-36 rounded-full border border-amber-400/8" />

        {/* Slowly rotating bolt ring */}
        <motion.div
          className="absolute w-60 h-60"
          animate={{ rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="absolute w-3.5 h-3.5 rounded-full border border-amber-400/12 bg-amber-400/5"
              style={{
                top: `calc(50% + ${Math.sin((i / 8) * Math.PI * 2) * 108}px - 7px)`,
                left: `calc(50% + ${Math.cos((i / 8) * Math.PI * 2) * 108}px - 7px)`,
              }}
            />
          ))}
        </motion.div>

        {/* Spoke lines at 4 diagonal angles (8 spokes total) */}
        {[0, 45, 90, 135].map((deg) => (
          <div
            key={deg}
            className="absolute w-56 h-px bg-amber-400/10"
            style={{ transform: `rotate(${deg}deg)` }}
          />
        ))}
      </div>

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
              isExploding || isSmoke
                ? 'bg-red-950/70 text-red-400 border-red-800'
                : isForming
                  ? 'bg-amber-950/70 text-amber-400 border-amber-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {LABELS[phase]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Central key stage */}
      <div className="relative flex items-center justify-center w-32 h-32">
        {/* Active / overheating key card */}
        <AnimatePresence mode="wait">
          {showActiveKey && (
            <motion.div
              key={`key-${keyIndex}`}
              initial={{ opacity: 0, scale: 0.3, rotate: -20 }}
              animate={{
                opacity: 1,
                scale: isOverheat ? [1, 1.15, 1.08] : 1,
                rotate: isOverheat ? [-4, 4, -4, 4, 0] : 0,
              }}
              exit={{ opacity: 0, scale: 2.5, filter: 'blur(10px)' }}
              transition={{
                duration: isOverheat ? 0.2 : 0.4,
                type: isOverheat ? 'tween' : 'spring',
                stiffness: 300,
                damping: 20,
              }}
              className={`absolute w-24 h-24 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 ${
                isOverheat
                  ? 'bg-slate-900 border-red-500'
                  : 'bg-slate-800 border-amber-500'
              }`}
              style={{
                boxShadow: isOverheat
                  ? '0 0 18px rgba(239,68,68,0.3)'
                  : '0 0 14px rgba(251,191,36,0.18)',
              }}
            >
              <motion.div
                animate={{
                  rotate: isOverheat
                    ? [-15, 15, -15, 15, 0]
                    : [0, 8, -8, 8, 0],
                }}
                transition={{
                  duration: isOverheat ? 0.15 : 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <KeyIcon
                  className={`w-10 h-10 ${isOverheat ? 'text-red-400' : 'text-amber-400'}`}
                />
              </motion.div>
              <span
                className={`text-[11px] font-mono font-bold ${isOverheat ? 'text-red-400' : 'text-amber-300'}`}
              >
                {keyLabel}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Explosion particles */}
        <AnimatePresence>
          {isExploding &&
            PARTICLES.map((p, i) => (
              <motion.div
                key={`p-${i}-${keyIndex}`}
                className={`absolute rounded-full ${p.color} ${p.size}`}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0 }}
                transition={{
                  duration: 0.55,
                  ease: 'easeOut',
                  delay: i * 0.015,
                }}
              />
            ))}
        </AnimatePresence>

        {/* Smoke clouds drifting upward */}
        <AnimatePresence>
          {(isExploding || isSmoke) &&
            [
              { x: 0, delay: 0.25, cls: 'w-10 h-10 blur-lg' },
              { x: -18, delay: 0.35, cls: 'w-7 h-7 blur-md' },
              { x: 18, delay: 0.3, cls: 'w-8 h-8 blur-lg' },
              { x: -9, delay: 0.45, cls: 'w-5 h-5 blur-md' },
              { x: 11, delay: 0.4, cls: 'w-6 h-6 blur-md' },
            ].map((s, i) => (
              <motion.div
                key={`smoke-${i}-${keyIndex}`}
                className={`absolute rounded-full bg-slate-400/35 ${s.cls}`}
                initial={{ x: s.x, y: 10, opacity: 0, scale: 0.4 }}
                animate={{
                  x: s.x * 1.4,
                  y: -58,
                  opacity: [0, 0.5, 0],
                  scale: [0.4, 1.8, 2.5],
                }}
                transition={{ duration: 1.5, ease: 'easeOut', delay: s.delay }}
              />
            ))}
        </AnimatePresence>

        {/* DESTROYED flash label */}
        <AnimatePresence>
          {(isExploding || isSmoke) && (
            <motion.div
              key={`destroyed-${keyIndex}`}
              initial={{ opacity: 0, scale: 1.4 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [1.4, 1, 1, 0.9] }}
              transition={{ duration: 1.5, times: [0, 0.15, 0.7, 1] }}
              className="absolute z-10 font-mono text-[11px] font-black text-red-400 bg-red-950/70 border border-red-800 rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-md"
            >
              {keyLabel} DESTROYED
            </motion.div>
          )}
        </AnimatePresence>

        {/* New key assembling from nothing */}
        <AnimatePresence>
          {isForming && (
            <motion.div
              key={`new-${keyIndex}`}
              initial={{ opacity: 0, scale: 0.2, rotate: -25 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              className="absolute w-24 h-24 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 border-amber-500 bg-slate-800"
              style={{ boxShadow: '0 0 14px rgba(251,191,36,0.2)' }}
            >
              {/* Orbiting sparkle dots */}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <motion.div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full bg-amber-400"
                  style={{
                    top: `${50 + 48 * Math.sin((i / 6) * Math.PI * 2)}%`,
                    left: `${50 + 48 * Math.cos((i / 6) * Math.PI * 2)}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                  transition={{
                    duration: 0.7,
                    repeat: Infinity,
                    delay: i * 0.12,
                  }}
                />
              ))}
              <KeyIcon className="w-10 h-10 text-amber-400" />
              <span className="text-[11px] font-mono font-bold text-amber-300">
                {nextKeyLabel}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Destroyed key graveyard (sliding window of last 5) */}
      <div className="absolute bottom-5 inset-x-0 flex justify-center gap-2 z-10">
        <AnimatePresence>
          {Array.from({ length: historyCount }).map((_, i) => {
            const globalIdx = startIdx + i;
            const isCurrent =
              globalIdx === keyIndex && phase <= 2;
            const isDestroyed =
              globalIdx < keyIndex ||
              (globalIdx === keyIndex && phase >= 3);
            return (
              <motion.div
                key={globalIdx}
                initial={{ opacity: 0, scale: 0, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0, x: -16 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="flex flex-col items-center gap-0.5"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                    isCurrent
                      ? 'bg-amber-900/40 border-amber-500'
                      : isDestroyed
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-amber-900/40 border-amber-500'
                  }`}
                >
                  {isDestroyed ? (
                    <span className="text-[9px] font-bold text-slate-600">
                      ✕
                    </span>
                  ) : (
                    <KeyIcon className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </div>
                <span className="text-[8px] font-mono text-slate-600">
                  K{globalIdx + 1}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
