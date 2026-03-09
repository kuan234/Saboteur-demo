# Render 部署说明

本项目已改为使用 **最新 React + Vite 前端构建产物**（`frontend/dist`），不再走旧版 HTML 首屏。

## 当前部署行为

- Render 构建时会执行：`npm ci && npm run build`
- `npm run build` 会自动在 `frontend/` 下安装依赖并执行 Vite build
- Node 服务启动后会：
  - 提供 `GET /healthz` 健康检查
  - 提供 `frontend/dist` 静态资源
  - 所有前端路由回退到 `frontend/dist/index.html`（SPA 路由可刷新）

## 部署方式

### 方式一：Blueprint（推荐）
1. 推送代码到 GitHub。
2. Render 里选择 **New + -> Blueprint**。
3. 选择本仓库，Render 会读取 `render.yaml` 自动创建服务。

### 方式二：手动创建 Web Service
1. **Build Command**: `npm ci && npm run build`
2. **Start Command**: `npm start`
3. **Health Check Path**: `/healthz`
4. Node 版本：18+


## 故障排查

- 如果日志出现 `ENOENT ... frontend/dist/index.html`，说明前端产物缺失。
- 现在项目已在根 `package.json` 增加 `postinstall` 自动执行前端构建；若你手动改过 Render 命令，请确保至少执行过 `npm run build`。
