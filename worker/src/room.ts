/**
 * Room Durable Object
 * 每个实例代表一个看护房间，按 4 位房间码命名。
 *
 * 角色：
 *  - broadcaster（星宝端）：唯一，发送视频帧 + 数据
 *  - subscriber（家长端）：可多个，只接收 broadcaster 转发的消息
 *
 * 不持久化任何视频数据：转发后立即丢弃。
 * 采用 WebSocket Hibernation API：空闲时释放内存，重启后仍能恢复在线连接列表。
 */

export class RoomDO implements DurableObject {
  state: DurableObjectState
  env: unknown

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // 路径以 /info 结尾：返回房间在线信息（不升级 WebSocket）
    if (url.pathname.endsWith('/info')) {
      const broadcasters = await this.state.getWebSockets('broadcaster')
      const subscribers = await this.state.getWebSockets('subscriber')
      return new Response(
        JSON.stringify({
          broadcasterOnline: broadcasters.length > 0,
          online: broadcasters.length + subscribers.length,
          subscribers: subscribers.length,
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    // 其余路径：WebSocket 升级
    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    const role = url.searchParams.get('role') === 'broadcaster' ? 'broadcaster' : 'subscriber'

    // broadcaster 唯一：先关闭已存在的 broadcaster 连接
    if (role === 'broadcaster') {
      const existing = await this.state.getWebSockets('broadcaster')
      for (const ws of existing) {
        try {
          ws.close(1000, 'replaced')
        } catch {}
      }
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // 接受连接并打 tag（hibernation 模式）
    this.state.acceptWebSocket(server, [role])

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const tags = this.state.getTags(ws)
    // 只转发 broadcaster 发送的消息给所有 subscriber
    if (tags.includes('broadcaster')) {
      const subscribers = await this.state.getWebSockets('subscriber')
      for (const sub of subscribers) {
        try {
          sub.send(message)
        } catch {}
      }
    }
    // subscriber 发送的消息（如 ping）不需要转发
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string): Promise<void> {
    // hibernation 模式下，连接信息由 state 自动管理；无需手动清理
    void ws
    void code
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try {
      ws.close(1011, 'unexpected error')
    } catch {}
  }
}
