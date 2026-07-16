/**
 * 会话内滑动窗口基线（POC 版，替代文档规划的 7 天个性化基线）。
 * 基线 = μ ± k·σ，z-score 分级。
 */
export class BaselineEngine {
  private window: number[] = []
  private readonly maxSize: number

  constructor(maxSize = 60) {
    this.maxSize = maxSize
  }

  push(value: number): void {
    this.window.push(value)
    if (this.window.length > this.maxSize) this.window.shift()
  }

  get mean(): number {
    if (this.window.length === 0) return 0
    return this.window.reduce((a, b) => a + b, 0) / this.window.length
  }

  get std(): number {
    if (this.window.length < 2) return 1
    const m = this.mean
    const variance =
      this.window.reduce((a, b) => a + (b - m) ** 2, 0) / this.window.length
    return Math.sqrt(variance)
  }

  /** 最新采样相对基线的 z-score */
  get zScore(): number {
    const last = this.window[this.window.length - 1]
    if (last === undefined) return 0
    return (last - this.mean) / (this.std || 1)
  }

  /** 至少 10 个采样才出基线 */
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
