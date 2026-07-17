/**
 * Room Durable Object
 * 存储星宝端最新帧数据，家长端轮询拉取。
 * 同时保留 WebSocket 能力（备用）。
 */
export class RoomDO implements DurableObject {
  state: DurableObjectState
  env: unknown
  latestData: any = null
  lastUpdate: number = 0

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }

    // 房间信息
    if (url.pathname.endsWith('/info')) {
      return new Response(
        JSON.stringify({
          broadcasterOnline: !!this.latestData && Date.now() - this.lastUpdate < 5000,
          online: this.latestData ? 1 : 0,
          subscribers: 0,
          lastUpdate: this.lastUpdate,
        }),
        { headers: corsHeaders },
      )
    }

    // POST 帧：星宝端推送
    if (url.pathname.endsWith('/frame') && request.method === 'POST') {
      try {
        const data = await request.json()
        this.latestData = data
        this.lastUpdate = Date.now()
        return new Response('{"ok":true}', { headers: corsHeaders })
      } catch {
        return new Response('{"error":"bad request"}', { status: 400, headers: corsHeaders })
      }
    }

    // GET 帧：家长端拉取
    if (url.pathname.endsWith('/frame') && request.method === 'GET') {
      if (this.latestData && Date.now() - this.lastUpdate < 10000) {
        return new Response(JSON.stringify(this.latestData), { headers: corsHeaders })
      }
      return new Response('{"error":"no data"}', { status: 404, headers: corsHeaders })
    }

    // WebSocket 升级（备用）
    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket or /frame', { status: 426 })
    }

    const role = url.searchParams.get('role') === 'broadcaster' ? 'broadcaster' : 'subscriber'
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
    if (tags.includes('broadcaster')) {
      const subscribers = await this.state.getWebSockets('subscriber')
      for (const sub of subscribers) {
        try { sub.send(message) } catch {}
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string): Promise<void> {
    void ws; void code
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try { ws.close(1011, 'error') } catch {}
  }
}
