import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import type { Reward } from './rewardsStore'

const ICONS: Record<Reward['type'], string> = {
  voice: '🎙️',
  wallpaper: '🖼️',
  counseling: '💝',
}

export function BlindBox({ reward, onClose }: { reward: Reward; onClose: () => void }) {
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    if (opened) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
    }
  }, [opened])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
        <AnimatePresence mode="wait">
          {!opened ? (
            <motion.div key="closed" exit={{ scale: 0, rotate: 180 }} transition={{ duration: 0.5 }}>
              <motion.div
                className="mx-auto mb-4 flex h-24 w-24 cursor-pointer items-center justify-center rounded-2xl bg-emerald-600/30 text-5xl"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                onClick={() => setOpened(true)}
              >
                🎁
              </motion.div>
              <p className="text-sm text-white/60">点击打开盲盒</p>
            </motion.div>
          ) : (
            <motion.div
              key="opened"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', duration: 0.8 }}
            >
              <div className="mb-3 text-5xl">{ICONS[reward.type]}</div>
              <p className="mb-1 text-sm font-medium text-emerald-300">解锁奖励！</p>
              <p className="mb-6 text-sm text-white/70">{reward.name}</p>
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white transition hover:bg-emerald-500"
              >
                收下奖励
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
