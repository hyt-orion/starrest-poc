import { saveIndex, getRecentIndices } from '../../infrastructure/ml/baselineStore'

/** 会话内滑动窗口基线 + IndexedDB 持久化（7天个性化） */
export class BaselineEngine {
  private window: number[] = []
  private readonly maxSize: number

  constructor(maxSize = 60) {
    this.maxSize = maxSize
  }

  /** 从 IndexedDB 加载最近7天历史，作为基线初始数据 */
  async initWithHistory(): Promise<void> {
    const history = await getRecentIndices(7)
    for (const r of history) {
      this.window.push(r.value)
    }
    if (this.window.length > this.maxSize) {
      this.window = this.window.slice(-this.maxSize)
    }
  }

  push(value: number): void {
    this.window.push(value)
    if (this.window.length > this.maxSize) this.window.shift()
    void saveIndex(value)
  }

  get mean(): number {
    if (this.window.length === 0) return 0
    return this.window.reduce((a, b) => a + b, 0) / this.window.length
  }

  get std(): number {
    if (this.window.length < 2) return 1
    const m = this.mean
    const variance = this.window.reduce((a, b) => a + (b - m) ** 2, 0) / this.window.length
    return Math.sqrt(variance)
  }

  get zScore(): number {
    const last = this.window[this.window.length - 1]
    if (last === undefined) return 0
    return (last - this.mean) / (this.std || 1)
  }

  get ready(): boolean {
    return this.window.length >= 10
  }

  get size(): number {
    return this.window.length
  }

  reset(): void {
    this.window = []
  }
}
