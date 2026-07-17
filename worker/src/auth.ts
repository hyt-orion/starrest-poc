/**
 * JWT + 密码哈希（纯 Web Crypto API，无外部依赖）
 * 适配 Cloudflare Workers 环境
 */

const encoder = new TextEncoder()

// ===== Base64URL =====

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ===== HMAC-SHA256 =====

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

// ===== JWT =====

export async function signJWT(userId: string, phone: string, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = { userId, phone, iat: now, exp: now + 30 * 24 * 3600 }

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)))
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)))
  const data = `${headerB64}.${payloadB64}`

  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const sigB64 = base64UrlEncode(sig)

  return `${data}.${sigB64}`
}

export async function verifyJWT(token: string, secret: string): Promise<{ userId: string; phone: string } | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [headerB64, payloadB64, sigB64] = parts
    const data = `${headerB64}.${payloadB64}`

    // 验证签名
    const key = await hmacKey(secret)
    const sigBytes = base64UrlDecode(sigB64)
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data))
    if (!valid) return null

    // 解析 payload
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)))
    
    // 检查过期时间
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) return null

    return { userId: payload.userId, phone: payload.phone }
  } catch {
    return null
  }
}

// ===== PBKDF2 密码哈希 =====

export async function hashPassword(password: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(secret), iterations: 100000, hash: 'SHA-256' },
    key, 256,
  )
  return base64UrlEncode(bits)
}

export async function verifyPassword(password: string, hash: string, secret: string): Promise<boolean> {
  const computed = await hashPassword(password, secret)
  return computed === hash
}

export function generateId(): string {
  return crypto.randomUUID()
}
