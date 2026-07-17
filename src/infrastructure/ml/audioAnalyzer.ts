/**
 * 音频分析器（端侧，不上传）
 * 用 AudioContext + AnalyserNode 计算频域 RMS 能量 + 频段能量分布。
 * 频段分布送入 audioClassifier 做简单分类（区分哭声/尖叫/撞击等）。
 */

import { classifyAudio } from './audioClassifier'

export interface AudioFeatures {
  audioScore: number // 0-100 音频活跃度
  isSilent: boolean // 是否静默
  energy: number // 原始 RMS 能量（0-1）
  frequencyBands: { low: number; mid: number; high: number } // 低/中/高频平均能量（0-1）
  audioType: string // 音频类型：speech/cry/scream/thud/silent/unknown
}

const SILENCE_THRESHOLD = 0.015 // RMS 低于此值视为静默

/**
 * 根据采样率计算频段分界 bin 索引。
 * 低频 0-300Hz，中频 300-1500Hz，高频 1500Hz 以上。
 * AnalyserNode 频率数据为 [0, sampleRate/2] 线性分布。
 */
function getBinRanges(binCount: number, sampleRate: number) {
  const binWidth = sampleRate / 2 / binCount
  const lowEnd = Math.max(1, Math.floor(300 / binWidth))
  const midEnd = Math.max(lowEnd + 1, Math.floor(1500 / binWidth))
  return {
    lowEnd: Math.min(lowEnd, binCount),
    midEnd: Math.min(midEnd, binCount),
  }
}

export class AudioAnalyzer {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private dataArray: Uint8Array | null = null

  start(stream: MediaStream): boolean {
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) return false

    this.ctx = new AudioContext()
    this.source = this.ctx.createMediaStreamSource(stream)
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.6
    this.source.connect(this.analyser)
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    return true
  }

  getFeatures(): AudioFeatures {
    const empty: AudioFeatures = {
      audioScore: 0,
      isSilent: true,
      energy: 0,
      frequencyBands: { low: 0, mid: 0, high: 0 },
      audioType: 'silent',
    }
    if (!this.analyser || !this.dataArray || !this.ctx) {
      return empty
    }
    this.analyser.getByteFrequencyData(this.dataArray as Uint8Array<ArrayBuffer>)

    const binCount = this.dataArray.length
    const sampleRate = this.ctx.sampleRate
    const { lowEnd, midEnd } = getBinRanges(binCount, sampleRate)

    // 计算总 RMS 能量 + 各频段平均能量
    let sum = 0
    let lowSum = 0
    let midSum = 0
    let highSum = 0
    let lowCount = 0
    let midCount = 0
    let highCount = 0
    for (let i = 0; i < binCount; i++) {
      const v = this.dataArray[i] / 255
      sum += v * v
      if (i < lowEnd) {
        lowSum += v
        lowCount++
      } else if (i < midEnd) {
        midSum += v
        midCount++
      } else {
        highSum += v
        highCount++
      }
    }
    const rms = Math.sqrt(sum / binCount)

    // 各频段平均能量（0-1）
    const low = lowCount > 0 ? lowSum / lowCount : 0
    const mid = midCount > 0 ? midSum / midCount : 0
    const high = highCount > 0 ? highSum / highCount : 0

    // 映射到 0-100（RMS 0~0.33 → 0~100）
    const audioScore = Math.min(Math.round(rms * 300), 100)
    const isSilent = rms < SILENCE_THRESHOLD

    // 频段分类
    const cls = classifyAudio({ low, mid, high }, rms)

    return {
      audioScore,
      isSilent,
      energy: rms,
      frequencyBands: { low, mid, high },
      audioType: cls.type,
    }
  }

  stop(): void {
    this.source?.disconnect()
    this.analyser?.disconnect()
    void this.ctx?.close()
    this.ctx = null
    this.analyser = null
    this.source = null
    this.dataArray = null
  }
}
