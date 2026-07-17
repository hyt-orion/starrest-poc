/**
 * 房间码配对
 * 房间码是 4 位数字（1000-9999），由后端 Room Durable Object 标识。
 * DO 在 WebSocket 连接时按需自动创建，无需提前 POST 创建。
 * 星宝端用 broadcaster 角色、家长端用 subscriber 角色连接。
 */

const WORKER_URL = 'https://starrest-api.starrest.workers.dev'

/** 生成房间码（纯客户端，无需后端请求） */
export function createRoom(): { code: string; error?: undefined } {
  const code = String(Math.floor(1000 + Math.random() * 9000))
  return { code }
}

/** 获取房间信息（在线人数、broadcaster 状态）— 可选，失败不阻塞 */
export async function getRoomInfo(
  code: string,
): Promise<{ broadcasterOnline?: boolean; online?: number; subscribers?: number; error?: string }> {
  if (!/^\d{4}$/.test(code)) {
    return { error: '房间码必须是 4 位数字' }
  }
  try {
    const res = await fetch(`${WORKER_URL}/api/room/${code}/info`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return { error: '房间不存在' }
    return await res.json()
  } catch {
    // 网络失败不阻塞，房间码仍然可用（DO 会在 WebSocket 连接时创建）
    return { broadcasterOnline: false, online: 0, subscribers: 0 }
  }
}

/** 加入房间：返回应连接的 WebSocket URL（按角色区分） */
export function joinRoom(code: string, role: 'broadcaster' | 'subscriber' = 'subscriber'): string {
  return buildWsUrl(code, role)
}

/** 拼接 WebSocket URL */
export function buildWsUrl(code: string, role: 'broadcaster' | 'subscriber'): string {
  const wsOrigin = WORKER_URL.replace(/^https?/, 'wss').replace(/^http/, 'ws')
  return `${wsOrigin}/api/room/${code}/ws?role=${role}`
}
