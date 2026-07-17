import { apiGetRewards, apiCompleteSession } from '../../shared/apiClient'

export interface Reward {
  id: string
  type: 'voice' | 'wallpaper' | 'counseling'
  name: string
  unlockedAt: number
  /** 奖励等级（1=语音、2=壁纸、3=咨询名额、4=专属称号） */
  tier?: number
}

export interface RewardState {
  totalSessions: number
  streak: number
  lastDate: string
  unlockedRewards: Reward[]
  /** 累计喘息总分钟数 */
  totalRelaxMinutes?: number
}

/** 喘息时长记录条目 */
export interface RelaxDurationEntry {
  type: string
  seconds: number
  time: number
}

const KEY = 'starrest_rewards'
const RELAX_KEY = 'starrest_relax_duration'

const DEFAULTS: RewardState = {
  totalSessions: 0,
  streak: 0,
  lastDate: '',
  unlockedRewards: [],
}

export function getRewards(): RewardState {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}

export async function fetchRewardsFromServer(): Promise<RewardState> {
  const res = await apiGetRewards()
  if (res.data) {
    const state: RewardState = {
      totalSessions: res.data.totalSessions,
      streak: res.data.streak,
      lastDate: res.data.lastDate,
      unlockedRewards: res.data.unlockedRewards || [],
    }
    localStorage.setItem(KEY, JSON.stringify(state))
    return state
  }
  return getRewards()
}

/** 随机鼓励语音列表 */
const VOICE_POOL = [
  '你今天做得很棒，给自己一个温柔的拥抱',
  '深呼吸，你已经为家人付出了很多',
  '照顾好自己，才能更好地照顾星宝',
  '你的每一次坚持，都被星光记得',
  '允许自己慢一点，世界可以等等你',
]

/** 随机壁纸 id 列表 */
const WALLPAPER_POOL = ['starry-night', 'moonlight-cabin', 'morning-glow', 'deep-forest', 'sunset-seaside']

/** 治愈壁纸名称（按 id 取） */
const WALLPAPER_NAMES: Record<string, string> = {
  'starry-night': '星空夜',
  'moonlight-cabin': '月光下的小屋',
  'morning-glow': '晨曦微光',
  'deep-forest': '森林深处',
  'sunset-seaside': '海边日落',
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * 根据连续打卡次数生成梯度奖励
 * 3 次 → 鼓励语音
 * 7 次 → 治愈壁纸
 * 14 次 → 心理咨询名额
 * 30 次 → 专属称号"守护星光"
 * 其他次数 → 随机小奖励（语音/壁纸）
 */
function grantRewardForStreak(streak: number): Reward {
  const now = Date.now()
  const id = `${now.toString(36)}-${streak}`
  if (streak === 3) {
    return { id, type: 'voice', name: '鼓励语音 · 连续3天', unlockedAt: now, tier: 1 }
  }
  if (streak === 7) {
    const wid = pick(WALLPAPER_POOL)
    return { id, type: 'wallpaper', name: `治愈壁纸 · ${WALLPAPER_NAMES[wid] || wid}`, unlockedAt: now, tier: 2 }
  }
  if (streak === 14) {
    return { id, type: 'counseling', name: '心理咨询名额 · 专业陪伴', unlockedAt: now, tier: 3 }
  }
  if (streak === 30) {
    return { id, type: 'voice', name: '专属称号：守护星光', unlockedAt: now, tier: 4 }
  }
  // 其他次数 → 随机语音或壁纸
  if (Math.random() < 0.5) {
    return { id, type: 'voice', name: pick(VOICE_POOL), unlockedAt: now, tier: 1 }
  }
  const wid = pick(WALLPAPER_POOL)
  return { id, type: 'wallpaper', name: `治愈壁纸 · ${WALLPAPER_NAMES[wid] || wid}`, unlockedAt: now, tier: 2 }
}

export async function completeSession(): Promise<{ state: RewardState; newReward: Reward }> {
  const res = await apiCompleteSession()
  if (res.data) {
    localStorage.setItem(KEY, JSON.stringify(res.data.state))
    return { state: res.data.state, newReward: res.data.newReward }
  }
  // 后端失败时本地兜底
  const state = getRewards()
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  state.totalSessions++
  if (state.lastDate === yesterday) state.streak++
  else if (state.lastDate !== today) state.streak = 1
  state.lastDate = today
  const newReward = grantRewardForStreak(state.streak)
  state.unlockedRewards.unshift(newReward)
  localStorage.setItem(KEY, JSON.stringify(state))
  return { state, newReward }
}

// ===== 喘息时长统计 =====

function readRelaxEntries(): RelaxDurationEntry[] {
  try {
    const arr = JSON.parse(localStorage.getItem(RELAX_KEY) || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeRelaxEntries(entries: RelaxDurationEntry[]): void {
  // 仅保留最近 30 天，避免无限增长
  const cutoff = Date.now() - 30 * 86400000
  const filtered = entries.filter((e) => e.time >= cutoff)
  localStorage.setItem(RELAX_KEY, JSON.stringify(filtered))
}

/** 记录一次喘息活动时长 */
export function logRelaxDuration(type: string, seconds: number): void {
  if (seconds <= 0) return
  const entries = readRelaxEntries()
  entries.push({ type, seconds, time: Date.now() })
  writeRelaxEntries(entries)
  // 同步更新总分钟数
  const state = getRewards()
  const prev = state.totalRelaxMinutes ?? 0
  state.totalRelaxMinutes = prev + Math.round(seconds / 60)
  localStorage.setItem(KEY, JSON.stringify(state))
}

/** 本周（最近 7 天）喘息总分钟数 */
export function getWeeklyRelaxMinutes(): number {
  const entries = readRelaxEntries()
  const cutoff = Date.now() - 7 * 86400000
  const totalSeconds = entries
    .filter((e) => e.time >= cutoff)
    .reduce((sum, e) => sum + e.seconds, 0)
  return Math.round(totalSeconds / 60)
}

/** 最近 7 天每天的喘息时长（分钟），按日期升序 */
export function getRelaxHistory(): { date: string; minutes: number }[] {
  const entries = readRelaxEntries()
  const result: { date: string; minutes: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000)
    const dateStr = day.toDateString()
    const seconds = entries
      .filter((e) => new Date(e.time).toDateString() === dateStr)
      .reduce((sum, e) => sum + e.seconds, 0)
    result.push({ date: dateStr, minutes: Math.round(seconds / 60) })
  }
  return result
}
