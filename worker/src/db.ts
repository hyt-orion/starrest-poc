import { generateId } from './auth'

export interface Env {
  DB: D1Database
  JWT_SECRET: string
  CORS_ORIGIN: string
}

// ===== Users =====

export async function createUser(db: D1Database, phone: string, passwordHash: string) {
  const id = generateId()
  const createdAt = Date.now()
  await db.prepare('INSERT INTO users (id, phone, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, phone, passwordHash, createdAt).run()
  await db.prepare('INSERT INTO settings (user_id) VALUES (?)').bind(id).run()
  await db.prepare('INSERT INTO rewards (user_id) VALUES (?)').bind(id).run()
  return { id, phone, createdAt }
}

export async function getUserByPhone(db: D1Database, phone: string) {
  return db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first<{
    id: string; phone: string; password_hash: string; created_at: number
  }>()
}

// ===== Settings =====

export async function getSettings(db: D1Database, userId: string) {
  const row = await db.prepare('SELECT * FROM settings WHERE user_id = ?').bind(userId).first<{
    alert_sensitivity: string; push_enabled: number
  }>()
  return {
    alertSensitivity: row?.alert_sensitivity ?? 'normal',
    pushEnabled: row?.push_enabled === 1,
  }
}

export async function saveSettings(db: D1Database, userId: string, sensitivity: string, pushEnabled: boolean) {
  await db.prepare(
    'INSERT INTO settings (user_id, alert_sensitivity, push_enabled) VALUES (?, ?, ?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET alert_sensitivity = ?, push_enabled = ?',
  ).bind(userId, sensitivity, pushEnabled ? 1 : 0, sensitivity, pushEnabled ? 1 : 0).run()
}

// ===== Rewards =====

export async function getRewards(db: D1Database, userId: string) {
  const row = await db.prepare('SELECT * FROM rewards WHERE user_id = ?').bind(userId).first<{
    total_sessions: number; streak: number; last_date: string; unlocked_rewards: string
  }>()
  return {
    totalSessions: row?.total_sessions ?? 0,
    streak: row?.streak ?? 0,
    lastDate: row?.last_date ?? '',
    unlockedRewards: row ? JSON.parse(row.unlocked_rewards) : [],
  }
}

export async function completeRewardSession(db: D1Database, userId: string) {
  const current = await getRewards(db, userId)
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  const totalSessions = current.totalSessions + 1
  let streak = current.streak
  if (current.lastDate === yesterday) streak++
  else if (current.lastDate !== today) streak = 1

  const id = generateId()
  let newReward: { id: string; type: string; name: string; unlockedAt: number }

  if (totalSessions % 5 === 0) {
    newReward = { id, type: 'counseling', name: '心理咨询名额', unlockedAt: Date.now() }
  } else {
    const pool = [
      { type: 'voice', name: '鼓励语音：你做得很好，休息也是爱孩子' },
      { type: 'wallpaper', name: '治愈壁纸：星空夜' },
      { type: 'voice', name: '鼓励语音：此刻的喘息，是为了更好的陪伴' },
      { type: 'wallpaper', name: '治愈壁纸：月光下的小屋' },
    ]
    const pick = pool[Math.floor(Math.random() * pool.length)]
    newReward = { id, type: pick.type, name: pick.name, unlockedAt: Date.now() }
  }

  const rewards = [newReward, ...current.unlockedRewards].slice(0, 50)
  await db.prepare(
    'UPDATE rewards SET total_sessions = ?, streak = ?, last_date = ?, unlocked_rewards = ? WHERE user_id = ?',
  ).bind(totalSessions, streak, today, JSON.stringify(rewards), userId).run()

  return {
    state: { totalSessions, streak, lastDate: today, unlockedRewards: rewards },
    newReward,
  }
}

// ===== Treehole =====

export async function getTreeholePosts(db: D1Database, limit = 50) {
  const results = await db.prepare('SELECT * FROM treehole ORDER BY created_at DESC LIMIT ?').bind(limit).all<{
    id: string; content: string; created_at: number
  }>()
  return results.results.map((r) => ({ id: r.id, text: r.content, time: r.created_at }))
}

export async function createTreeholePost(db: D1Database, content: string) {
  const id = generateId()
  const createdAt = Date.now()
  await db.prepare('INSERT INTO treehole (id, content, created_at) VALUES (?, ?, ?)')
    .bind(id, content, createdAt).run()
  return { id, text: content, time: createdAt }
}

// ===== Baseline =====

export async function getBaseline(db: D1Database, userId: string, days = 7) {
  const since = Date.now() - days * 86400000
  const results = await db.prepare('SELECT value, timestamp FROM baseline WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp ASC')
    .bind(userId, since).all<{ value: number; timestamp: number }>()
  return results.results.map((r) => ({ timestamp: r.timestamp, value: r.value }))
}

export async function saveBaselineEntry(db: D1Database, userId: string, value: number) {
  await db.prepare('INSERT INTO baseline (user_id, value, timestamp) VALUES (?, ?, ?)')
    .bind(userId, value, Date.now()).run()
}
