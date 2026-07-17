/**
 * 房间码配对 API
 * 房间码是 4 位数字（1000-9999），由后端 Room Durable Object 标识。
 * 星宝端用 broadcaster 角色、家长端用 subscriber 角色连接。
 */
import { apiCreateRoom, apiGetRoomInfo } from './apiClient'

const WORKER_URL = 'https://starrest-api.starrest.workers.dev'

/** 创建房间，返回 4 位房间码 */
export async function createRoom(): Promise<{ code: string; error?: string }> {
  const res = await apiCreateRoom()
  if (res.data?.code) return { code: res.data.code }
  return { code: '', error: res.error || '创建房间失败' }
}

/** 获取房间信息（在线人数、broadcaster 状态） */
export async function getRoomInfo(
  code: string,
): Promise<{ broadcasterOnline?: boolean; online?: number; subscribers?: number; error?: string }> {
  if (!/^\d{4}$/.test(code)) {
    return { error: '房间码必须是 4 位数字' }
  }
  const res = await apiGetRoomInfo(code)
  if (res.data) return res.data
  return { error: res.error || '获取房间信息失败' }
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
