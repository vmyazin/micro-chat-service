'use client';

import { motion } from 'framer-motion';

export function NerdGhostDemo() {
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
