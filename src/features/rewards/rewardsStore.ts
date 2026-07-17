import { apiGetRewards, apiCompleteSession } from '../../shared/apiClient'

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
  const id = Date.now().toString(36)
  const newReward: Reward = { id, type: 'voice', name: '鼓励语音（离线）', unlockedAt: Date.now() }
  state.unlockedRewards.unshift(newReward)
  localStorage.setItem(KEY, JSON.stringify(state))
  return { state, newReward }
}
