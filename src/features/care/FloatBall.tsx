import { motion } from 'framer-motion'
import { LEVEL_COLORS, LEVEL_LABELS, type AlertLevel } from './alertClassifier'

interface FloatBallProps {
  index: number
  level: AlertLevel
  baselineReady: boolean
  pushEnabled: boolean
}

/**
 * 悬浮球：平时安安静静显示活跃指数，
 * 仅干预级（act）且强提醒开启时触发脉冲动画。
 */
export function FloatBall({ index, level, baselineReady, pushEnabled }: FloatBallProps) {
  const color = LEVEL_COLORS[level]
  const pulsing = level === 'act' && pushEnabled
  return (
    <motion.div
      role="img"
      aria-label={`活跃指数 ${baselineReady ? index : '等待中'}，${LEVEL_LABELS[level]}`}
      className="flex h-20 w-20 select-none flex-col items-center justify-center rounded-full shadow-lg shadow-black/50"
      style={{ backgroundColor: color }}
      animate={pulsing ? { scale: [1, 1.18, 1] } : { scale: 1 }}
      transition={{ repeat: pulsing ? Infinity : 0, duration: 0.8 }}
    >
      <span className="text-2xl font-bold text-white">
        {baselineReady ? index : '--'}
      </span>
      <span className="text-[10px] text-white/80">
        {LEVEL_LABELS[level]}
      </span>
    </motion.div>
  )
}
