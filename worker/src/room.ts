/**
 * Room Durable Object
 * 每个实例代表一个看护房间，按 4 位房间码命名。
 *
 * 角色：
 *  - broadcaster（星宝端）：唯一，发送视频帧 + 数据
 *  - subscriber（家长端）：可多个，只接收 broadcaster 转发的消息
 *
 * 不持久化任何视频数据：转发后即丢弃。
 * 使用传统 WebSocket API（非 Hibernation），更简单可靠。
 */
export class RoomDO implements DurableObject {
  state: DurableObjectState
  env: unknown
  broadcaster: WebSocket | null = null
  subscribers: Set<WebSocket> = new Set()

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // 房间信息
    if (url.pathname.endsWith('/info')) {
      return new Response(
        JSON.stringify({
          broadcasterOnline: !!this.broadcaster,
          online: (this.broadcaster ? 1 : 0) + this.subscribers.size,
          subscribers: this.subscribers.size,
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    // WebSocket 升级
    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    const role = url.searchParams.get('role') === 'broadcaster' ? 'broadcaster' : 'subscriber'

    // broadcaster 唯一：先关闭旧的
    if (role === 'broadcaster' && this.broadcaster) {
      try { this.broadcaster.close(1000, 'replaced') } catch {}
      this.broadcaster = null
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // 传统模式：手动 accept
    server.accept()

    if (role === 'broadcaster') {
      this.broadcaster = server

      // broadcaster 发的消息 → 转发给所有 subscriber
      server.addEventListener('message', (event: MessageEvent) => {
        for (const sub of this.subscribers) {
          try {
            sub.send(event.data)
          } catch {}
        }
      })

      server.addEventListener('close', () => {
        if (this.broadcaster === server) this.broadcaster = null
      })

      server.addEventListener('error', () => {
        if (this.broadcaster === server) this.broadcaster = null
      })
    } else {
      // subscriber
      this.subscribers.add(server)

      server.addEventListener('close', () => {
        this.subscribers.delete(server)
      })

      server.addEventListener('error', () => {
        this.subscribers.delete(server)
      })
    }

    return new Response(null, { status: 101, webSocket: client })
  }
}
