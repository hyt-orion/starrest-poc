import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import type { Reward } from './rewardsStore'
import { getWallpaperById, unlockWallpaper } from '../../shared/wallpapers'
import { speak, isTTSAvailable } from '../../shared/tts'

const ICONS: Record<Reward['type'], string> = {
  voice: '🎙️',
  wallpaper: '🖼️',
  counseling: '💝',
}

/** 从奖励 name 里提取壁纸 id（奖励名格式：治愈壁纸 · 星空夜） */
function extractWallpaperId(name: string): string | null {
  const map: Record<string, string> = {
    '星空夜': 'starry-night',
    '月光下的小屋': 'moonlight-cabin',
    '晨曦微光': 'morning-glow',
    '森林深处': 'deep-forest',
    '海边日落': 'sunset-seaside',
  }
  for (const k of Object.keys(map)) {
    if (name.includes(k)) return map[k]
  }
  return null
}

/** 用 canvas 生成壁纸图片并触发下载 */
function downloadWallpaper(css: string, filename: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  // 解析 linear-gradient / radial-gradient 较复杂，这里采用简化方案：
  // 用 CSS 渐变在离屏 DOM 上绘制后再绘制到 canvas
  const off = document.createElement('div')
  off.style.width = '1080px'
  off.style.height = '1920px'
  off.style.background = css
  off.style.position = 'fixed'
  off.style.left = '-9999px'
  off.style.top = '-9999px'
  document.body.appendChild(off)
  // 使用 SVG foreignObject 把 DOM 渲染成图
  const xml = new XMLSerializer().serializeToString(off)
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`
  document.body.removeChild(off)
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  const img = new Image()
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 1080, 1920)
    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }
  img.onerror = () => {
    // SVG foreignObject 方案失败时，降级：直接把 PNG 链接给用户
    const a = document.createElement('a')
    a.href = url
    a.download = filename.replace('.png', '.svg')
    a.click()
  }
  img.src = url
}

export function BlindBox({ reward, onClose }: { reward: Reward; onClose: () => void }) {
  const [opened, setOpened] = useState(false)
  const [spoken, setSpoken] = useState(false)

  // 壁纸相关
  const wallpaperId = reward.type === 'wallpaper' ? extractWallpaperId(reward.name) : null
  const wallpaper = wallpaperId ? getWallpaperById(wallpaperId) : null

  // 开箱后解锁壁纸
  useEffect(() => {
    if (opened && wallpaperId) unlockWallpaper(wallpaperId)
  }, [opened, wallpaperId])

  useEffect(() => {
    if (opened) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
    }
  }, [opened])

  function handleSetBackground() {
    if (wallpaper) {
      localStorage.setItem('starrest_bg', wallpaper.css)
    }
  }

  function handleDownload() {
    if (wallpaper) {
      downloadWallpaper(wallpaper.css, `starrest-${wallpaper.id}.png`)
    }
  }

  function handlePlayVoice() {
    if (isTTSAvailable()) {
      void speak(reward.name)
      setSpoken(true)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
        <AnimatePresence mode="wait">
          {!opened ? (
            <motion.div key="closed" exit={{ scale: 0, rotate: 180 }} transition={{ duration: 0.5 }}>
              <motion.div
                className="mx-auto mb-4 flex h-24 w-24 cursor-pointer items-center justify-center rounded-2xl bg-emerald-600/30 text-5xl"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                onClick={() => setOpened(true)}
              >
                🎁
              </motion.div>
              <p className="text-sm text-white/60">点击打开盲盒</p>
            </motion.div>
          ) : (
            <motion.div
              key="opened"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', duration: 0.8 }}
            >
              <div className="mb-3 text-5xl">{ICONS[reward.type]}</div>
              <p className="mb-1 text-sm font-medium text-emerald-300">解锁奖励！</p>
              <p className="mb-4 text-sm text-white/70">{reward.name}</p>

              {/* 壁纸预览 */}
              {reward.type === 'wallpaper' && wallpaper && (
                <div className="mb-4">
                  <div
                    className="mx-auto h-32 w-full rounded-xl ring-1 ring-slate-700"
                    style={{ background: wallpaper.css, backgroundSize: 'cover' }}
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleSetBackground}
                      className="flex-1 rounded-lg bg-emerald-600/40 px-3 py-2 text-xs text-emerald-100 transition hover:bg-emerald-600/60"
                    >
                      设为背景
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-xs text-white/70 transition hover:bg-slate-600"
                    >
                      下载
                    </button>
                  </div>
                </div>
              )}

              {/* 语音播放 */}
              {reward.type === 'voice' && isTTSAvailable() && (
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={handlePlayVoice}
                    className="flex-1 rounded-lg bg-emerald-600/40 px-3 py-2 text-xs text-emerald-100 transition hover:bg-emerald-600/60"
                  >
                    {spoken ? '再听一次 ▶' : '播放 ▶'}
                  </button>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white transition hover:bg-emerald-500"
              >
                收下奖励
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
