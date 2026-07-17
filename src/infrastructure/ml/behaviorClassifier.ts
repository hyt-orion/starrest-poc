import type { NormalizedPoint } from './moveNetDetector'

export type BehaviorType = 'normal' | 'arm_flapping' | 'head_banging' | 'spinning' | 'stillness'

export interface BehaviorResult {
  type: BehaviorType
  confidence: number
  message: string
}

// MoveNet 17 关键点索引
// 0=nose, 5=left_shoulder, 6=right_shoulder,
// 7=left_elbow, 8=right_elbow,
// 9=left_wrist, 10=right_wrist,
// 11=left_hip, 12=right_hip
const NOSE = 0
const LEFT_SHOULDER = 5
const RIGHT_SHOULDER = 6
const LEFT_ELBOW = 7
const RIGHT_ELBOW = 8
const LEFT_WRIST = 9
const RIGHT_WRIST = 10

const HISTORY_SIZE = 30 // 约 6 秒（5fps）
let keypointHistory: NormalizedPoint[][] = []

export function pushKeypoints(keypoints: NormalizedPoint[]) {
  keypointHistory.push([...keypoints])
  if (keypointHistory.length > HISTORY_SIZE) keypointHistory.shift()
}

export function resetBehaviorHistory() {
  keypointHistory = []
}

/**
 * 基于 MoveNet 关键点序列的行为分类器。
 * 检测 4 种自闭症相关行为：摆臂 / 撞头 / 旋转 / 长静默。
 * 方法：特征工程 + 阈值规则 + 多特征加权（不需要训练模型）。
 *
 * 在原有规则之上新增三类特征：
 * 1. 关键点速度（手腕、手肘每帧位移）—— 区分主动运动与静止抖动
 * 2. 身体对称度（左右手腕/手肘相对躯干中心的对称性）—— 摆臂通常双侧对称
 * 3. 自相关周期性（代替 FFT，检测重复模式）—— 摆臂/旋转具有明显周期
 */
export function classifyBehavior(): BehaviorResult {
  if (keypointHistory.length < 10) {
    return { type: 'normal', confidence: 0, message: '收集数据中' }
  }

  // === 特征提取 ===

  // 1. 整体运动量（所有关键点平均位移）
  let totalMovement = 0
  for (let i = 1; i < keypointHistory.length; i++) {
    for (let j = 0; j < keypointHistory[i].length; j++) {
      const dx = keypointHistory[i][j].x - keypointHistory[i - 1][j].x
      const dy = keypointHistory[i][j].y - keypointHistory[i - 1][j].y
      totalMovement += Math.sqrt(dx * dx + dy * dy)
    }
  }
  const avgMovement = totalMovement / (keypointHistory.length - 1) / 17

  // 2. 关键点速度特征（手腕、手肘）
  const lwVel = computeKeypointVelocity(LEFT_WRIST)
  const rwVel = computeKeypointVelocity(RIGHT_WRIST)
  const leVel = computeKeypointVelocity(LEFT_ELBOW)
  const reVel = computeKeypointVelocity(RIGHT_ELBOW)
  const wristVel = Math.max(lwVel, rwVel)
  const elbowVel = Math.max(leVel, reVel)
  const armVel = Math.max(wristVel, elbowVel)

  // 3. 身体对称度（左右手腕/手肘相对躯干中心的对称性）
  const symmetryScore = computeSymmetryScore()

  // 4. 周期性检测（自相关）：手腕 y 序列与肩 x 差序列
  const lwY = keypointHistory.map((f) => f[LEFT_WRIST]?.y ?? 0.5)
  const rwY = keypointHistory.map((f) => f[RIGHT_WRIST]?.y ?? 0.5)
  const wristPeriodicity = Math.max(
    autocorrelationPeriodicity(lwY),
    autocorrelationPeriodicity(rwY),
  )
  const shoulderXDiff = keypointHistory.map((f) => {
    const ls = f[LEFT_SHOULDER]?.x ?? 0
    const rs = f[RIGHT_SHOULDER]?.x ?? 0
    return rs - ls
  })
  const spinPeriodicity = autocorrelationPeriodicity(shoulderXDiff)

  // === 行为检测（多特征加权）===

  // 长静默：所有关键点位移极低 + 手臂速度极低
  if (avgMovement < 0.005 && armVel < 0.01) {
    return { type: 'stillness', confidence: 0.85, message: '长时间静止' }
  }

  // 摆臂：手腕 y 周期性振荡 + 自相关周期性 + 手臂速度
  const flapOscScore = Math.max(detectOscillation(lwY), detectOscillation(rwY))
  const armVelScore = Math.min(armVel / 0.05, 1)
  // 多特征加权：振荡 0.4 + 周期性 0.4 + 手臂速度 0.2
  let flapConfidence = flapOscScore * 0.4 + wristPeriodicity * 0.4 + armVelScore * 0.2
  // 对称性调整：双侧对称挥动更像摆臂；单侧挥动置信度略降
  if (symmetryScore > 0.7) flapConfidence = Math.min(flapConfidence * 1.1, 1)
  else if (symmetryScore < 0.3) flapConfidence *= 0.85
  if (flapConfidence > 0.5) {
    return { type: 'arm_flapping', confidence: flapConfidence, message: '疑似摆臂' }
  }

  // 撞头：手腕靠近头部 + 手腕速度
  let headCount = 0
  for (const f of keypointHistory) {
    const nose = f[NOSE]
    const lw = f[LEFT_WRIST]
    const rw = f[RIGHT_WRIST]
    if (nose && lw && Math.hypot(nose.x - lw.x, nose.y - lw.y) < 0.12) headCount++
    if (nose && rw && Math.hypot(nose.x - rw.x, nose.y - rw.y) < 0.12) headCount++
  }
  const headRatio = headCount / keypointHistory.length
  // 多特征加权：接触比例 0.7 + 手腕速度 0.3
  const headVelScore = Math.min(wristVel / 0.05, 1)
  const headConfidence = Math.min(headRatio * 0.7 + headVelScore * 0.3, 1)
  if (headRatio > 0.2 && headConfidence > 0.4) {
    return { type: 'head_banging', confidence: headConfidence, message: '疑似撞头' }
  }

  // 旋转：左右肩 x 位置频繁交替 + 周期性
  let swapCount = 0
  for (let i = 1; i < keypointHistory.length; i++) {
    const pl = keypointHistory[i - 1][LEFT_SHOULDER]?.x ?? 0
    const pr = keypointHistory[i - 1][RIGHT_SHOULDER]?.x ?? 0
    const cl = keypointHistory[i][LEFT_SHOULDER]?.x ?? 0
    const cr = keypointHistory[i][RIGHT_SHOULDER]?.x ?? 0
    if ((pl < pr) !== (cl < cr)) swapCount++
  }
  const swapRatio = swapCount / keypointHistory.length
  // 多特征加权：交换比例 0.6 + 周期性 0.4
  const spinConfidence = Math.min(swapRatio * 0.6 + spinPeriodicity * 0.4, 1)
  if (swapRatio > 0.15 && spinConfidence > 0.4) {
    return { type: 'spinning', confidence: spinConfidence, message: '疑似旋转' }
  }

  return { type: 'normal', confidence: 0.9, message: '行为正常' }
}

/** 计算指定关键点的平均速度（每帧位移） */
function computeKeypointVelocity(idx: number): number {
  if (keypointHistory.length < 2) return 0
  let sum = 0
  let count = 0
  for (let i = 1; i < keypointHistory.length; i++) {
    const prev = keypointHistory[i - 1][idx]
    const curr = keypointHistory[i][idx]
    if (prev && curr) {
      sum += Math.hypot(curr.x - prev.x, curr.y - prev.y)
      count++
    }
  }
  return count > 0 ? sum / count : 0
}

/**
 * 计算身体对称度。
 * 比较左右手腕、手肘相对躯干中心（两肩中点）的距离差，归一化到肩宽。
 * 返回 0-1，1 表示完全对称。
 */
function computeSymmetryScore(): number {
  if (keypointHistory.length === 0) return 1
  let totalScore = 0
  let count = 0
  for (const f of keypointHistory) {
    const ls = f[LEFT_SHOULDER]
    const rs = f[RIGHT_SHOULDER]
    const lw = f[LEFT_WRIST]
    const rw = f[RIGHT_WRIST]
    const le = f[LEFT_ELBOW]
    const re = f[RIGHT_ELBOW]
    if (!ls || !rs) continue
    const cx = (ls.x + rs.x) / 2
    const cy = (ls.y + rs.y) / 2
    const shoulderW = Math.max(Math.hypot(ls.x - rs.x, ls.y - rs.y), 1e-6)
    let frameScore = 0
    let pairCount = 0
    if (lw && rw) {
      const dl = Math.hypot(lw.x - cx, lw.y - cy)
      const dr = Math.hypot(rw.x - cx, rw.y - cy)
      const diff = Math.abs(dl - dr) / shoulderW
      frameScore += Math.max(0, 1 - diff)
      pairCount++
    }
    if (le && re) {
      const dl = Math.hypot(le.x - cx, le.y - cy)
      const dr = Math.hypot(re.x - cx, re.y - cy)
      const diff = Math.abs(dl - dr) / shoulderW
      frameScore += Math.max(0, 1 - diff)
      pairCount++
    }
    if (pairCount > 0) {
      totalScore += frameScore / pairCount
      count++
    }
  }
  return count > 0 ? totalScore / count : 1
}

/**
 * 自相关周期性检测（代替 FFT）。
 * 计算信号在不同时移下与自身的相关度，取最大峰值。
 * 返回 0-1，1 表示强周期性。
 */
function autocorrelationPeriodicity(signal: number[]): number {
  if (signal.length < 8) return 0
  const n = signal.length
  // 去均值
  const mean = signal.reduce((a, b) => a + b, 0) / n
  const centered = signal.map((v) => v - mean)
  // 归一化能量
  let energy = 0
  for (const v of centered) energy += v * v
  if (energy < 1e-8) return 0 // 信号几乎恒定，不算周期性
  // 计算自相关（lag 从 2 到 n/2）
  let maxCorr = 0
  const maxLag = Math.floor(n / 2)
  for (let lag = 2; lag <= maxLag; lag++) {
    let corr = 0
    for (let i = 0; i < n - lag; i++) {
      corr += centered[i] * centered[i + lag]
    }
    corr = corr / energy
    if (corr > maxCorr) maxCorr = corr
  }
  return Math.max(0, Math.min(maxCorr, 1))
}

/** 检测信号的周期性振荡（过零率 × 幅度） */
function detectOscillation(signal: number[]): number {
  if (signal.length < 5) return 0
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length
  let crossings = 0
  let amplitude = 0
  for (let i = 1; i < signal.length; i++) {
    if ((signal[i - 1] < mean) !== (signal[i] < mean)) crossings++
    amplitude += Math.abs(signal[i] - mean)
  }
  amplitude /= signal.length
  const crossingRate = crossings / signal.length
  const ampScore = Math.min(amplitude / 0.03, 1)
  return Math.min(crossingRate * 2 * ampScore, 1)
}
