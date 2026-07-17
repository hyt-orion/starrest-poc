import { generateId } from './auth'

export interface Env {
  DB: D1Database
  JWT_SECRET: string
  CORS_ORIGIN: string
  ROOM: DurableObjectNamespace
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

// ===== Event Log =====

export async function createEventLog(
  db: D1Database,
  userId: string,
  type: string,
  detail: string = '',
) {
  const id = generateId()
  const timestamp = Date.now()
  await db.prepare(
    'INSERT INTO event_log (id, user_id, type, detail, timestamp) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, userId, type, detail, timestamp).run()
  return { id, userId, type, detail, timestamp }
}

export async function getEventLogs(db: D1Database, userId: string, limit = 50) {
  const results = await db.prepare(
    'SELECT id, user_id, type, detail, timestamp FROM event_log WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
  ).bind(userId, limit).all<{ id: string; user_id: string; type: string; detail: string; timestamp: number }>()
  return results.results
}

export async function deleteEventLog(db: D1Database, id: string) {
  await db.prepare('DELETE FROM event_log WHERE id = ?').bind(id).run()
}

// ===== Care Reports =====

export async function saveCareReport(
  db: D1Database,
  userId: string,
  date: string,
  avgIndex: number,
  behaviorCounts: Record<string, number>,
  relaxMinutes: number,
) {
  const id = generateId()
  const timestamp = Date.now()
  await db.prepare(
    'INSERT INTO care_reports (id, user_id, date, avg_index, behavior_counts, relax_minutes, timestamp) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, userId, date, avgIndex, JSON.stringify(behaviorCounts), relaxMinutes, timestamp).run()
  return { id, userId, date, avgIndex, behaviorCounts, relaxMinutes, timestamp }
}

export async function getCareReports(db: D1Database, userId: string, limit = 30) {
  const results = await db.prepare(
    'SELECT id, user_id, date, avg_index, behavior_counts, relax_minutes, timestamp ' +
    'FROM care_reports WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
  ).bind(userId, limit).all<{
    id: string; user_id: string; date: string; avg_index: number
    behavior_counts: string; relax_minutes: number; timestamp: number
  }>()
  return results.results.map((r) => ({
    id: r.id,
    userId: r.user_id,
    date: r.date,
    avgIndex: r.avg_index,
    behaviorCounts: JSON.parse(r.behavior_counts || '{}') as Record<string, number>,
    relaxMinutes: r.relax_minutes,
    timestamp: r.timestamp,
  }))
}

export async function deleteCareReport(db: D1Database, id: string) {
  await db.prepare('DELETE FROM care_reports WHERE id = ?').bind(id).run()
}

// ===== Relax Sessions =====

export async function createRelaxSession(
  db: D1Database,
  userId: string,
  type: string,
  durationSeconds: number,
) {
  const id = generateId()
  const timestamp = Date.now()
  await db.prepare(
    'INSERT INTO relax_sessions (id, user_id, type, duration_seconds, timestamp) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, userId, type, durationSeconds, timestamp).run()
  return { id, userId, type, durationSeconds, timestamp }
}

export async function getRelaxSessions(db: D1Database, userId: string, limit = 50) {
  const results = await db.prepare(
    'SELECT id, user_id, type, duration_seconds, timestamp FROM relax_sessions ' +
    'WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
  ).bind(userId, limit).all<{
    id: string; user_id: string; type: string; duration_seconds: number; timestamp: number
  }>()
  return results.results.map((r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    durationSeconds: r.duration_seconds,
    timestamp: r.timestamp,
  }))
}

export async function deleteRelaxSession(db: D1Database, id: string) {
  await db.prepare('DELETE FROM relax_sessions WHERE id = ?').bind(id).run()
}

// ===== 定时清理（Cron Trigger 调用） =====

/**
 * 清理超过指定天数的旧数据
 * - baseline 表：按 timestamp 清理
 * - treehole 表：按 created_at 清理
 * - 同时清理 event_log / care_reports / relax_sessions（统一按 timestamp 7 天衰减）
 * 返回每张表删除的行数。
 */
export async function cleanupOldRecords(db: D1Database, days = 7) {
  const cutoff = Date.now() - days * 86400000
  const results = await db.batch([
    db.prepare('DELETE FROM baseline WHERE timestamp < ?').bind(cutoff),
    db.prepare('DELETE FROM treehole WHERE created_at < ?').bind(cutoff),
    db.prepare('DELETE FROM event_log WHERE timestamp < ?').bind(cutoff),
    db.prepare('DELETE FROM care_reports WHERE timestamp < ?').bind(cutoff),
    db.prepare('DELETE FROM relax_sessions WHERE timestamp < ?').bind(cutoff),
  ])
  return {
    cutoff,
    deleted: results.map((r) => r.meta?.changes ?? 0),
  }
}
