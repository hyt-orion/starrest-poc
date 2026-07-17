/**
 * Room Durable Object（Hibernation API）
 * broadcaster 发消息 → 转发给所有 subscriber
 * subscriber 发 ping → 忽略（仅用于保活）
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

    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    const role = url.searchParams.get('role') === 'broadcaster' ? 'broadcaster' : 'subscriber'

    // broadcaster 唯一：先关闭已存在的
    if (role === 'broadcaster') {
      const existing = await this.state.getWebSockets('broadcaster')
      for (const ws of existing) {
        try { ws.close(1000, 'replaced') } catch {}
      }
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.state.acceptWebSocket(server, [role])

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const tags = this.state.getTags(ws)
    // 只转发 broadcaster 发送的消息给所有 subscriber
    if (tags.includes('broadcaster')) {
      const subscribers = await this.state.getWebSockets('subscriber')
      for (const sub of subscribers) {
        try { sub.send(message) } catch {}
      }
    }
    // subscriber 发的 ping 忽略
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string): Promise<void> {
    void ws; void code
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try { ws.close(1011, 'error') } catch {}
  }
}
