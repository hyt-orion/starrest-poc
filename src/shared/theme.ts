/**
 * 主题切换工具
 * 通过给 document.documentElement 设置 data-theme 属性，
 * 并注入一段 style 标签覆盖 Tailwind 工具类的颜色，
 * 实现深色/浅色主题切换。
 *
 * 因 index.css 不在本任务可改文件范围内，
 * 这里采用运行时注入 style 标签的方式覆盖颜色变量。
 */

export type Theme = 'dark' | 'light'

const THEME_KEY = 'starrest_theme'
const STYLE_ID = 'starrest-theme-overrides'

/** 读取当前主题，默认深色 */
export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/**
 * 在 document.documentElement 上设置 data-theme 属性，
 * 并注入/清理用于覆盖 Tailwind 颜色类的 style 标签。
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }

  if (theme === 'light') {
    // 浅色主题：覆盖深色背景与白色文字
    style.textContent = `
      [data-theme="light"] body { background-color: #f8fafc !important; color: #0f172a !important; }
      [data-theme="light"] .bg-slate-950 { background-color: #f8fafc !important; }
      [data-theme="light"] .bg-slate-900 { background-color: #f1f5f9 !important; }
      [data-theme="light"] .bg-slate-800 { background-color: #e2e8f0 !important; }
      [data-theme="light"] .bg-slate-800\\/30 { background-color: rgba(226,232,240,0.5) !important; }
      [data-theme="light"] .text-white { color: #0f172a !important; }
      [data-theme="light"] .text-white\\/80 { color: rgba(15,23,42,0.8) !important; }
      [data-theme="light"] .text-white\\/70 { color: rgba(15,23,42,0.7) !important; }
      [data-theme="light"] .text-white\\/60 { color: rgba(15,23,42,0.6) !important; }
      [data-theme="light"] .text-white\\/50 { color: rgba(15,23,42,0.55) !important; }
      [data-theme="light"] .text-white\\/40 { color: rgba(15,23,42,0.45) !important; }
      [data-theme="light"] .text-white\\/30 { color: rgba(15,23,42,0.35) !important; }
      [data-theme="light"] .border-slate-800 { border-color: #cbd5e1 !important; }
      [data-theme="light"] .border-slate-700 { border-color: #cbd5e1 !important; }
      [data-theme="light"] .divide-slate-800 > * + * { border-color: #cbd5e1 !important; }
      [data-theme="light"] .ring-slate-700 { --tw-ring-color: #cbd5e1 !important; }
    `
  } else {
    // 深色主题：清理覆盖，恢复默认
    style.textContent = ''
  }
}

/** 持久化主题并立即应用 */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* localStorage 不可用时静默 */
  }
  applyTheme(theme)
}

/** 在深色/浅色之间切换，返回切换后的主题 */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}
