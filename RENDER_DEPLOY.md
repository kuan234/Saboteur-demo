# Render 部署说明

本项目已经适配 Render：

- 服务监听 `process.env.PORT`（`server.js` 已支持）。
- 新增了健康检查路由：`GET /healthz`。
- 根路径 `/` 会返回 `public/index.legacy.html`。
- 新增 `render.yaml`，可用于 Render Blueprint 一键创建服务。

## 部署方式

### 方式一：使用 Blueprint（推荐）
1. 推送代码到 GitHub。
2. 在 Render 里选择 **New + -> Blueprint**。
3. 选择本仓库，Render 会读取 `render.yaml` 自动创建服务。

### 方式二：手动创建 Web Service
1. **Build Command**: `npm install`
2. **Start Command**: `npm start`
3. **Health Check Path**: `/healthz`
4. 环境选择 Node 18+。
