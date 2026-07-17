/**
 * 治愈壁纸数据
 * 全部用 CSS 渐变生成，无需外部图片资源
 */

export interface Wallpaper {
  id: string
  name: string
  /** CSS background 值，可直接用于 style.background */
  css: string
  /** 是否已解锁（由 rewardsStore 解锁时回填） */
  unlocked: boolean
}

/** 全部壁纸原始定义（不含解锁状态，由 getAllWallpapers 合并） */
const WALLPAPER_DEFS: Array<Omit<Wallpaper, 'unlocked'>> = [
  {
    id: 'starry-night',
    name: '星空夜',
    // 深蓝紫渐变 + 顶部星点（用 radial-gradient 模拟）
    css: `
      radial-gradient(circle at 20% 30%, rgba(255,255,255,0.9) 0, rgba(255,255,255,0) 1.5px),
      radial-gradient(circle at 70% 20%, rgba(255,255,255,0.8) 0, rgba(255,255,255,0) 1.5px),
      radial-gradient(circle at 40% 70%, rgba(255,255,255,0.7) 0, rgba(255,255,255,0) 1.2px),
      radial-gradient(circle at 85% 65%, rgba(255,255,255,0.85) 0, rgba(255,255,255,0) 1.4px),
      radial-gradient(circle at 60% 85%, rgba(255,255,255,0.75) 0, rgba(255,255,255,0) 1.3px),
      linear-gradient(160deg, #0f1535 0%, #2a1a55 45%, #4b2a8a 100%)
    `.trim().replace(/\s+/g, ' '),
  },
  {
    id: 'moonlight-cabin',
    name: '月光下的小屋',
    // 深蓝绿渐变
    css: `linear-gradient(165deg, #0a2a3a 0%, #0f3d4a 40%, #1f5f5a 100%)`,
  },
  {
    id: 'morning-glow',
    name: '晨曦微光',
    // 橙粉渐变
    css: `linear-gradient(160deg, #ffb27a 0%, #ff9aa2 45%, #ffd6e0 100%)`,
  },
  {
    id: 'deep-forest',
    name: '森林深处',
    // 深绿渐变
    css: `linear-gradient(165deg, #0a2a1a 0%, #1a4030 45%, #2f5f3f 100%)`,
  },
  {
    id: 'sunset-seaside',
    name: '海边日落',
    // 橙紫渐变
    css: `linear-gradient(160deg, #ff8a3d 0%, #d36a8c 50%, #6a4a9f 100%)`,
  },
]

/** 读取本地已解锁壁纸 id 列表 */
function getUnlockedIds(): Set<string> {
  try {
    const arr = JSON.parse(localStorage.getItem('starrest_unlocked_wallpapers') || '[]')
    return new Set<string>(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

/** 标记某个壁纸为已解锁（持久化） */
export function unlockWallpaper(id: string): void {
  const set = getUnlockedIds()
  set.add(id)
  localStorage.setItem('starrest_unlocked_wallpapers', JSON.stringify(Array.from(set)))
}

/** 返回所有壁纸（含解锁状态） */
export function getAllWallpapers(): Wallpaper[] {
  const unlocked = getUnlockedIds()
  return WALLPAPER_DEFS.map((w) => ({ ...w, unlocked: unlocked.has(w.id) }))
}

/** 根据名称或 id 返回 CSS background 值，找不到时返回 null */
export function getWallpaperCSS(name: string): string | null {
  const found = WALLPAPER_DEFS.find((w) => w.name === name || w.id === name)
  return found ? found.css : null
}

/** 根据 id 查找壁纸 */
export function getWallpaperById(id: string): Wallpaper | null {
  const unlocked = getUnlockedIds()
  const found = WALLPAPER_DEFS.find((w) => w.id === id)
  return found ? { ...found, unlocked: unlocked.has(found.id) } : null
}
