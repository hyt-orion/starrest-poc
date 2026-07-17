/**
 * 桌面通知工具
 * 干预级提醒时由调用方主动调用 sendNotification 发送系统通知。
 */

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** 请求通知权限，返回最终权限状态 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/** 发送一条系统通知，无权限或不支持时静默忽略 */
export function sendNotification(title: string, body: string): void {
  if (!isNotificationSupported()) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/starrest-poc/icon-192.png' })
  } catch {
    /* 某些浏览器要求 ServiceWorkerRegistration 通知，这里降级静默 */
  }
}
