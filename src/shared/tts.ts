/**
 * TTS 语音引导模块
 * 基于 Web Speech API (speechSynthesis) 实现中文语音引导
 */

let zhVoice: SpeechSynthesisVoice | null = null
let sequenceTimer: number | null = null

/** 初始化时挑选中文语音（zh-CN） */
function pickChineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices || voices.length === 0) return null
  // 优先 zh-CN，其次任何 zh 开头
  return (
    voices.find((v) => v.lang === 'zh-CN') ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('zh')) ||
    null
  )
}

/** 浏览器是否支持 TTS */
export function isTTSAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined'
}

/** 在 voices 异步加载完成后缓存中文语音 */
function ensureVoice(): SpeechSynthesisVoice | null {
  if (!isTTSAvailable()) return null
  if (!zhVoice) zhVoice = pickChineseVoice()
  return zhVoice
}

// 部分浏览器需要监听 voiceschanged 事件才能拿到语音列表
if (isTTSAvailable()) {
  ensureVoice()
  window.speechSynthesis.onvoiceschanged = () => {
    zhVoice = pickChineseVoice()
  }
}

/** 朗读单段文本，返回 Promise 在朗读结束后 resolve */
export function speak(text: string): Promise<void> {
  if (!isTTSAvailable() || !text) return Promise.resolve()
  // 取消队列中尚未播放的内容，避免堆积
  try { window.speechSynthesis.cancel() } catch { /* noop */ }
  if (sequenceTimer !== null) {
    window.clearTimeout(sequenceTimer)
    sequenceTimer = null
  }
  return new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    const v = ensureVoice()
    if (v) u.voice = v
    u.lang = 'zh-CN'
    u.rate = 0.8 // 语速偏慢，便于跟随放松
    u.pitch = 1
    u.volume = 1
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

/**
 * 按间隔依次朗读多段文本
 * @param texts 文本数组
 * @param interval 每段朗读结束后到下一段开始之间的间隔毫秒数
 */
export function speakSequence(texts: string[], interval: number): void {
  if (!isTTSAvailable() || texts.length === 0) return
  // 重新开始前先清掉旧任务
  stopSpeak()
  let i = 0
  async function step() {
    if (i >= texts.length) return
    const cur = texts[i++]
    await speak(cur)
    if (i < texts.length) {
      sequenceTimer = window.setTimeout(step, interval)
    } else {
      sequenceTimer = null
    }
  }
  void step()
}

/** 停止所有朗读并清空队列 */
export function stopSpeak(): void {
  if (!isTTSAvailable()) return
  try { window.speechSynthesis.cancel() } catch { /* noop */ }
  if (sequenceTimer !== null) {
    window.clearTimeout(sequenceTimer)
    sequenceTimer = null
  }
}
