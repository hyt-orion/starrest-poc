export interface Reward {
  id: string
  type: 'voice' | 'wallpaper' | 'counseling'
  name: string
  unlockedAt: number
}

export interface RewardState {
  totalSessions: number
  streak: number
  lastDate: string
  unlockedRewards: Reward[]
}

const KEY = 'starrest_rewards'

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

/** 完成一次活动，更新计数+连续打卡，返回新奖励 */
export function completeSession(): { state: RewardState; newReward: Reward } {
  const state = getRewards()
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  state.totalSessions++
  if (state.lastDate === yesterday) state.streak++
  else if (state.lastDate !== today) state.streak = 1
  state.lastDate = today

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  let newReward: Reward

  if (state.totalSessions % 5 === 0) {
    newReward = { id, type: 'counseling', name: '心理咨询名额', unlockedAt: Date.now() }
  } else {
    const pool = [
      { type: 'voice' as const, name: '鼓励语音：你做得很好，休息也是爱孩子' },
      { type: 'wallpaper' as const, name: '治愈壁纸：星空夜' },
      { type: 'voice' as const, name: '鼓励语音：此刻的喘息，是为了更好的陪伴' },
      { type: 'wallpaper' as const, name: '治愈壁纸：月光下的小屋' },
    ]
    const pick = pool[Math.floor(Math.random() * pool.length)]
    newReward = { id, type: pick.type, name: pick.name, unlockedAt: Date.now() }
  }

  state.unlockedRewards.unshift(newReward)
  localStorage.setItem(KEY, JSON.stringify(state))
  return { state, newReward }
}
