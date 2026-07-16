import { useState, type ReactNode } from 'react'

interface Page {
  title: string
  content: ReactNode
}

const PAGES: Page[] = [
  {
    title: '欢迎使用星憩时刻',
    content: (
      <div className="space-y-3">
        <p>星憩时刻是一款面向星宝（孤独症儿童）家长的 AI 看护产品。</p>
        <p>核心不是教你怎么带孩子，而是<strong className="text-emerald-300">替你看着孩子</strong>，让你暂时不用当家长，喘口气。</p>
      </div>
    ),
  },
  {
    title: '使用方法',
    content: (
      <div className="space-y-3">
        <p><strong className="text-white">左半 · 家长端</strong>：悬浮球显示孩子活跃指数和分级（常规/关注/预警/干预），下方是喘息活动入口（冥想 / 手作 / 树洞）。</p>
        <p><strong className="text-white">右半 · 星宝端</strong>：摄像头实时看护画面，AI 监测孩子状态。</p>
        <p>平时一切正常时悬浮球安安静静，你可以完全不看手机。仅<strong className="text-red-300">干预级</strong>异常才触发强提醒。</p>
      </div>
    ),
  },
  {
    title: '注册与登录',
    content: (
      <div className="space-y-3">
        <p><strong className="text-white">手机号 + 密码</strong>：首次输入手机号和密码将自动注册账号，后续用同样信息直接登录。密码至少 6 位。</p>
        <p><strong className="text-white">微信 / QQ</strong>：当前为模拟登录，上线后接入真实第三方授权。</p>
        <p>手机号为唯一账号标识，微信 / QQ 可绑定到同一账号。</p>
      </div>
    ),
  },
  {
    title: '重要提醒',
    content: (
      <div className="space-y-3">
        <p>📌 需要授权<strong className="text-white">摄像头权限</strong>，视频数据<strong className="text-emerald-300">仅本地处理，不上传云端</strong>。</p>
        <p>📌 本产品是陪伴辅助工具，<strong className="text-red-300">不能替代专业医疗和康复</strong>。</p>
        <p>📌 请在孩子处于安全环境时使用，干预级提醒仍需家长人工确认。</p>
      </div>
    ),
  },
]

export function OnboardingOverlay({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0)
  const isLast = page === PAGES.length - 1

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="no-scrollbar mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-8">
        {/* 进度指示 */}
        <div className="mb-6 flex justify-center gap-2">
          {PAGES.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${i === page ? 'w-6 bg-emerald-500' : 'w-2 bg-slate-600'}`}
            />
          ))}
        </div>

        {/* 标题 */}
        <h2 className="mb-5 text-center text-xl font-bold text-white">{PAGES[page].title}</h2>

        {/* 内容 */}
        <div className="text-sm leading-relaxed text-white/70">
          {PAGES[page].content}
        </div>

        {/* 按钮：没有跳过，必须翻完 */}
        <div className="mt-8 flex gap-3">
          {page > 0 && (
            <button
              onClick={() => setPage(page - 1)}
              className="rounded-xl bg-slate-700 px-6 py-3 text-sm text-white/70 transition hover:bg-slate-600"
            >
              上一页
            </button>
          )}
          <button
            onClick={() => (isLast ? onDone() : setPage(page + 1))}
            className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            {isLast ? '我已了解，开始使用' : '下一页'}
          </button>
        </div>

        {/* 页码 */}
        <p className="mt-4 text-center text-xs text-white/30">
          {page + 1} / {PAGES.length}
        </p>
      </div>
    </div>
  )
}
