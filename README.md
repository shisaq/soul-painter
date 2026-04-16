# 灵魂画师 Soul Painter

一个有趣的 AI 绘画小应用，支持两种玩法：

- **词作画** — 输入文字描述，AI 用蜡笔风格帮你画出来
- **画猜图** — 在画布上随意涂鸦，让 AI 猜你画的是什么

基于 React + Vite + Tailwind CSS，使用 Gemini API 提供 AI 能力。

## 本地运行

**前置条件：** Node.js

1. 安装依赖：`npm install`
2. 在项目根目录创建 `.env` 文件，添加你的 Gemini API Key：
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
3. 启动开发服务器：`npm run dev`
4. 访问 `http://localhost:3000`

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 导入该仓库
3. 在 Vercel 项目 Settings > Environment Variables 中添加 `GEMINI_API_KEY`
4. 部署完成，API Key 仅存在于服务端，不会暴露到前端
