/**
 * 音频分类器（端侧，不上传）
 *
 * 由于 package.json 未安装 @tensorflow-models/speech-commands，
 * 这里改用 Web Audio API 的频段能量分布做简单分类。
 *
 * 分类依据：
 * - 尖叫 scream：高频能量占比高且总能量较大
 * - 撞击 thud：低频能量占比高、中高频较弱（低频脉冲）
 * - 哭声 cry：中频能量主导且总能量较高（典型 300-1500Hz）
 * - 说话 speech：中频占主导但能量较低
 * - 静默 silent：总能量极低
 * - 未知 unknown：不匹配上述模式
 */

export type AudioType = 'speech' | 'cry' | 'scream' | 'thud' | 'silent' | 'unknown'

export interface AudioClassificationResult {
  type: AudioType
  confidence: number
  description: string
}

const SILENCE_THRESHOLD = 0.015 // 总 RMS 能量低于此值视为静默

/**
 * 基于频段能量分布分类音频类型。
 *
 * @param bands 归一化频段平均能量（0-1），分别为低频、中频、高频
 * @param totalEnergy 总 RMS 能量（0-1），用于判断是否静默
 */
export function classifyAudio(
  bands: { low: number; mid: number; high: number },
  totalEnergy: number,
): AudioClassificationResult {
  // 静默判断
  if (totalEnergy < SILENCE_THRESHOLD) {
    return { type: 'silent', confidence: 0.9, description: '静默' }
  }

  const { low, mid, high } = bands
  const total = low + mid + high || 1
  const lowRatio = low / total
  const midRatio = mid / total
  const highRatio = high / total

  // 尖叫：高频能量占比高，且总能量较大
  if (highRatio > 0.5 && totalEnergy > 0.05) {
    const confidence = Math.min(highRatio * 1.2 + totalEnergy * 0.5, 1)
    return { type: 'scream', confidence, description: '疑似尖叫' }
  }

  // 撞击：低频能量占比高，中高频较弱（低频脉冲）
  if (lowRatio > 0.55 && midRatio < 0.35) {
    const confidence = Math.min(lowRatio * 1.2, 1)
    return { type: 'thud', confidence, description: '疑似撞击' }
  }

  // 哭声：中频能量主导且总能量较高
  if (midRatio > 0.45 && totalEnergy > 0.03) {
    const confidence = Math.min(midRatio + totalEnergy * 0.5, 1)
    return { type: 'cry', confidence, description: '疑似哭声' }
  }

  // 说话：中频占主导但能量较低
  if (midRatio > 0.4 && totalEnergy > 0.01) {
    const confidence = Math.min(midRatio * 0.8, 1)
    return { type: 'speech', confidence, description: '疑似说话' }
  }

  return { type: 'unknown', confidence: 0.3, description: '未识别' }
}
