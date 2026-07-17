/**
 * 异常事件记录（干预级事件）
 * 数据持久化在 localStorage，key = 'starrest_event_log'
 * - logEvent(type, detail): 记录一条事件
 * - getEvents(): 获取全部事件（按时间倒序）
 * - clearEvents(): 清空事件
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/** 事件类型 */
export type EventType = 'alert' | 'act' | 'manual' | 'system'

export interface CareEvent {
  id: string
  type: EventType
  /** 行为分类描述（来自 ChildPage behaviorClassifier） */
  detail: string
  /** 当时的活跃指数 */
  index?: number
  timestamp: number
}

const KEY = 'starrest_event_log'
const MAX_EVENTS = 500

function readAll(): CareEvent[] {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? (JSON.parse(raw) as CareEvent[]) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeAll(events: CareEvent[]): void {
  try {
    // 仅保留最近 MAX_EVENTS 条
    const trimmed = events.slice(0, MAX_EVENTS)
    localStorage.setItem(KEY, JSON.stringify(trimmed))
  } catch {
    /* localStorage 满或不可用时静默 */
  }
}

/** 记录一条事件 */
export function logEvent(type: EventType, detail: string, index?: number): CareEvent {
  const event: CareEvent = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    detail,
    index,
    timestamp: Date.now(),
  }
  const all = readAll()
  all.unshift(event)
  writeAll(all)
  // 通知其他监听者
  window.dispatchEvent(new CustomEvent('starrest:events-updated'))
  return event
}

/** 获取所有事件，按时间倒序 */
export function getEvents(): CareEvent[] {
  return readAll()
}

/** 清空所有事件 */
export function clearEvents(): void {
  writeAll([])
  window.dispatchEvent(new CustomEvent('starrest:events-updated'))
}

const TYPE_LABELS: Record<EventType, string> = {
  alert: '预警',
  act: '干预',
  manual: '手动',
  system: '系统',
}

const TYPE_COLORS: Record<EventType, string> = {
  alert: '#f97316',
  act: '#ef4444',
  manual: '#3b82f6',
  system: '#64748b',
}

/** 事件记录页面组件 */
export function EventLog() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<CareEvent[]>(() => getEvents())

  useEffect(() => {
    function handler() {
      setEvents(getEvents())
    }
    window.addEventListener('starrest:events-updated', handler)
    return () => window.removeEventListener('starrest:events-updated', handler)
  }, [])

  function handleClear() {
    if (events.length === 0) return
    if (confirm(`确认清空 ${events.length} 条事件记录？此操作不可恢复。`)) {
      clearEvents()
    }
  }

  function handleAddManual() {
    const detail = prompt('请输入事件描述')
    if (detail && detail.trim()) {
      logEvent('manual', detail.trim())
    }
  }

  return (
    <div className="min-h-full bg-slate-950 text-white">
      <div className="flex items-center justify-between border-b border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="text-white/60 hover:text-white">
            ← 返回
          </button>
          <h1 className="text-lg font-medium">事件记录</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAddManual}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white/80 hover:bg-slate-700"
          >
            + 手动记录
          </button>
          <button
            onClick={handleClear}
            disabled={events.length === 0}
            className="rounded-lg bg-red-900/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/50 disabled:opacity-40"
          >
            清空
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
          <p className="text-sm text-white/40">暂无事件记录</p>
          <p className="text-xs text-white/30">干预级异常会自动记录到这里</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-800">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-3 p-4">
              <span
                className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full"
                style={{ backgroundColor: TYPE_COLORS[e.type] }}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/90">
                    {TYPE_LABELS[e.type]}
                    {typeof e.index === 'number' && (
                      <span className="ml-2 text-xs text-white/50">指数 {e.index}</span>
                    )}
                  </span>
                  <span className="text-xs text-white/40">{formatTime(e.timestamp)}</span>
                </div>
                <p className="mt-1 text-sm text-white/70">{e.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
