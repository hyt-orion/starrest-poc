import { motion } from 'framer-motion'
import { LEVEL_COLORS, LEVEL_LABELS, type AlertLevel } from './alertClassifier'

interface FloatBallProps {
  index: number
  level: AlertLevel
  baselineReady: boolean
  pushEnabled: boolean
  /** 最近 60 个指数值，用于绘制迷你折线图 */
  history?: number[]
  /** 行为分类描述，干预级时显示在球上方 */
  behavior?: string
}

/**
 * 悬浮球：平时安安静静显示活跃指数，
 * 仅干预级（act）且强提醒开启时触发脉冲动画。
 *
 * 增强：
 * - 球下方显示最近 60 秒活跃指数迷你折线图
 * - 干预级（act）时球上方显示行为图标
 */
export function FloatBall({
  index,
  level,
  baselineReady,
  pushEnabled,
  history = [],
  behavior,
}: FloatBallProps) {
  const color = LEVEL_COLORS[level]
  const pulsing = level === 'act' && pushEnabled
  return (
    <div className="flex select-none flex-col items-center gap-1">
      {/* 干预级时球上方显示行为图标 */}
      {level === 'act' && (
        <motion.div
          key="behavior-icon"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-200"
          aria-live="polite"
        >
          {behavior ? `${behaviorIcon(behavior)} ${behavior}` : '⚠ 需要关注'}
        </motion.div>
      )}

      <motion.div
        role="img"
        aria-label={`活跃指数 ${baselineReady ? index : '等待中'}，${LEVEL_LABELS[level]}`}
        className="flex h-20 w-20 flex-col items-center justify-center rounded-full shadow-lg shadow-black/50"
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

      {/* 最近 60 秒活跃指数迷你折线图 */}
      {history.length > 1 && (
        <svg
          width="96"
          height="24"
          viewBox="0 0 96 24"
          className="opacity-80"
          aria-label="最近 60 秒活跃指数趋势"
        >
          <MiniLine data={history} stroke={color} />
        </svg>
      )}
    </div>
  )
}

/** 根据行为描述选择 emoji 图标 */
function behaviorIcon(behavior: string): string {
  if (behavior.includes('挥手') || behavior.includes('摇') || behavior.includes('晃')) return '👋'
  if (behavior.includes('走') || behavior.includes('跑') || behavior.includes('动')) return '🏃'
  if (behavior.includes('哭') || behavior.includes('叫') || behavior.includes('喊')) return '😱'
  if (behavior.includes('静') || behavior.includes('不动')) return '💤'
  if (behavior.includes('摇') || behavior.includes(' stereotyp')) return '🔄'
  return '⚠'
}

/** 纯 SVG 迷你折线图 */
function MiniLine({ data, stroke }: { data: number[]; stroke: string }) {
  const w = 96
  const h = 24
  const n = data.length
  if (n < 2) return null
  // 固定 0-100 区间，便于横向对比
  const min = 0
  const max = 100
  const range = max - min
  const points = data
    .map((v, i) => {
      const x = (i / (n - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  return (
    <polyline
      points={points}
      fill="none"
      stroke={stroke}
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  )
}
