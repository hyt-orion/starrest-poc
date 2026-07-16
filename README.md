# 星憩时刻 · 看护核心链路 POC

> 验证文档规划的生死链路：**摄像头 → MediaPipe Pose → 活跃指数（0-100）→ 悬浮球（四级分级）**

## 预览

**[点击预览](https://webview.e2b.bj10.sandbox.cloudstudio.club/?x-cs-sandbox-id=e806408bfc104592a502f253221dd7ac&x-cs-sandbox-port=8000)**

如果上方链接无法打开，复制下方地址到浏览器访问：
```
https://webview.e2b.bj10.sandbox.cloudstudio.club/?x-cs-sandbox-id=e806408bfc104592a502f253221dd7ac&x-cs-sandbox-port=8000
```

> ⚠️ 需要摄像头权限。首次打开会请求授权，请允许。视频数据仅本地处理，不上传任何云端。

## 已验证

- ✅ 脚手架：Vite 6 + React 18 + TS 5 + pnpm + Tailwind + Framer Motion
- ✅ 类型检查：`tsc --noEmit` 零错误
- ✅ 构建：`vite build` 成功（391 模块，1.84s）
- ✅ 预览部署：HTTP 200

## 文件结构

```
src/
├── App.tsx                              # 入口
├── features/care/
│   ├── CareDashboard.tsx                # 看护主页面（推理循环）
│   ├── useCameraStream.ts               # 摄像头流 hook（getUserMedia）
│   ├── activityIndex.ts                 # 活跃指数算法（关节位移能量→0-100）
│   ├── baselineEngine.ts                # 会话内基线（滑动窗口 μ±σ + z-score）
│   ├── alertClassifier.ts               # 四级分级（常规/关注/预警/干预）
│   └── FloatBall.tsx                    # 悬浮球 UI（仅干预级脉冲）
└── infrastructure/ml/
    └── poseDetector.ts                  # MediaPipe Pose 封装（端侧推理）
```

## 核心链路

```
摄像头 getUserMedia
  → <video> 实时流
  → MediaPipe PoseLandmarker（端侧 GPU 推理，~5fps 降频省电）
  → 33 个关键点位移能量 E_v = (1/N)·Σ||p_i(t) − p_i(t−Δ)||
  → 归一化映射 → 活跃指数 0-100
  → 滑动窗口基线（60 样本）μ ± σ → z-score
  → |z| ≤ 2 常规 | ≤ 3 关注 | ≤ 4 预警 | > 4 干预
  → 悬浮球（颜色 + 干预级脉冲动画）
```

对应文档调用链 1：`CareDashboard → useCameraStream → inferenceEngine → alertClassifier → FloatBall`

## 算法说明

| 组件 | 方法 | 来源 |
|---|---|---|
| 人体姿态 | MediaPipe Pose Lite（33 关键点，端侧 WebGL/GPU） | 调研分报告一 |
| 活跃指数 | 关节位移能量归一化，阈值 0.001（静止）~0.05（大幅运动） | 调研分报告一·三节 |
| 基线 | 滑动窗口均值±标准差（POC 用 60 样本替代 7 天基线） | 调研分报告一·三节 |
| 分级 | z-score 四级（k=2/3/4），仅干预级强提醒 | 调研分报告一·四节 |
| 降频 | ~5fps（200ms 间隔），避免 7×24 功耗发热 | 调研分报告一·六节 |

## 本地运行

```bash
cd /workspace/starrest-poc
pnpm install
pnpm dev      # 开发模式（需 localhost 或 HTTPS 才能用摄像头）
pnpm build    # 生产构建
```

## POC 范围（已做 / 未做）

| 已做（POC） | 未做（后续） |
|---|---|
| 摄像头流 + 权限处理 | 音频侧 YAMNet（环境音检测） |
| MediaPipe Pose 端侧推理 | Web Worker 移帧（主线程→Worker） |
| 活跃指数（视频侧） | 多模态加权（视频+音频合成） |
| 会话内基线 + z-score | 7 天个性化基线（IndexedDB 持久化） |
| 四级分级 + 悬浮球 UI | Web Push 强提醒（干预级） |
| 隐私提示（视频不出设备） | 自闭症刻板行为分类器（需自研） |
| 错误处理（摄像头拒绝） | 隐私首屏（可查看/删除+指示灯） |

## 已知限制

1. **摄像头要求**：`getUserMedia` 需要 HTTPS 或 localhost。预览链接是 HTTPS，满足条件，但沙箱浏览器可能无物理摄像头。
2. **模型加载**：首次从 CDN 加载 MediaPipe WASM + 模型（~几秒），后续浏览器缓存。
3. **主线程推理**：POC 在主线程跑 MediaPipe，可能卡顿。验证链路后移到 Web Worker。
4. **基线**：POC 用会话内 60 样本基线，非文档规划的 7 天个性化基线。
5. **声音克隆**：已确认延后，不进 MVP。
