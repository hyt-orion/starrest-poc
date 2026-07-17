import { SignJWT, jwtVerify } from 'jose'

const encoder = new TextEncoder()

/** 简单密码哈希（Worker 不支持 bcrypt，用 PBKDF2 替代） */
export async function hashPassword(password: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(secret), iterations: 100000, hash: 'SHA-256' },
    key, 256,
  )
  return btoa(String.fromCharCode(...new Uint8Array(bits)))
}

export async function verifyPassword(password: string, hash: string, secret: string): Promise<boolean> {
  const computed = await hashPassword(password, secret)
  return computed === hash
}

export async function signJWT(userId: string, phone: string, secret: string): Promise<string> {
  return new SignJWT({ userId, phone })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(encoder.encode(secret))
}

export async function verifyJWT(token: string, secret: string): Promise<{ userId: string; phone: string } | null> {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret))
    return { userId: payload.userId as string, phone: payload.phone as string }
  } catch {
    return null
  }
}

export function generateId(): string {
  return crypto.randomUUID()
}
