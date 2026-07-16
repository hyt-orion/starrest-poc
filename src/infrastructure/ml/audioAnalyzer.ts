/**
 * 音频分析器（端侧，不上传）
 * 用 AudioContext + AnalyserNode 计算频域 RMS 能量。
 * 后续可升级为 YAMNet 分类（区分哭声/尖叫/撞击）。
 */

export interface AudioFeatures {
  audioScore: number // 0-100 音频活跃度
  isSilent: boolean // 是否静默
  energy: number // 原始 RMS 能量（0-1）
}

const SILENCE_THRESHOLD = 0.015 // RMS 低于此值视为静默

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
    if (!this.analyser || !this.dataArray) {
      return { audioScore: 0, isSilent: true, energy: 0 }
    }
    this.analyser.getByteFrequencyData(this.dataArray)

    // 计算频域 RMS 能量
    let sum = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      const v = this.dataArray[i] / 255
      sum += v * v
    }
    const rms = Math.sqrt(sum / this.dataArray.length)

    // 映射到 0-100（RMS 0~0.33 → 0~100）
    const audioScore = Math.min(Math.round(rms * 300), 100)
    const isSilent = rms < SILENCE_THRESHOLD

    return { audioScore, isSilent, energy: rms }
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
