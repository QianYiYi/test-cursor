## 单细胞实验室预约系统（全栈版）

该目录是 `test-project/` 下的全栈实现：**React（前端） + Node.js/Express（后端） + MySQL（数据库）**。

### 功能

- **预约登记**：录入预约记录（销售/合同/客户/解离/样本/上门时间/实验员/数量/测序类型/平台/通知方式等）
- **预约记录**：表格展示、筛选、编辑、删除、状态流转（待完成/进行中/已完成）
- **订单状态看板**：按状态展示数量与列表
- **统计趋势**：状态分布、测序类型/平台分布、按天趋势与简要分析
- **导出 Excel**：导出当前筛选结果
- **实验员配置**：支持实验员名单/联系方式/默认通知方式维护（管理员）
- **权限管理**：登录鉴权 + 角色/权限点；支持用户管理、角色管理、菜单权限动态渲染
- **行级数据权限**：
  - 技术员：仅可查看分配给自己的预约，且仅可更新自己订单状态
  - 客户：仅可增删改查自己创建的预约记录
  - 管理技术员：可查看全部预约，并可重新分配上门实验员
- **统计增强**：
  - 技术员可同时查看公司统计与个人统计（总量、完成/未完成、趋势、测序类型分布）
  - 客户可查看公司每日预约量日历（仅数量，无明细），并显示今日/本周/本月总量
- **预约后通知**：提交预约后按通知方式通知实验员（邮件/手机号码/Teams/微信/其他）

### 本地运行（MySQL 已安装场景）

在 `fullstack/` 下执行：

1) 启动数据库（MySQL + Adminer）

```bash
docker compose up -d
```

2) 初始化表结构（含实验员与通知日志表）

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p<你的密码> sc_booking < db/schema.sql
```

3) 启动后端

```bash
cd backend
npm i
npm run dev
```

4) 启动前端

```bash
cd ../frontend
npm i
npm run dev
```

> 开发阶段：`vite.config.js` 已将 **`/api` 代理到后端**（默认 `http://127.0.0.1:3001`，可用 `VITE_PROXY_TARGET` 修改）。前端 `VITE_API_BASE_URL` 留空时请求走同源 `/api`，**无需跨域**。
>
> **`npm run preview` 也已配置相同 `/api` 代理**。若用 `serve` 等仅静态托管、未反代 `/api`，会出现 **`/api/calendar/...` 404**——请用 Nginx 把 `/api` 转到后端，或构建前设置 `VITE_API_BASE_URL` 为**后端根地址**（不要带末尾 `/api`，例如 `http://127.0.0.1:3001`）。
>
> 生产构建为静态文件时：由 Nginx 反代 `/api`，或配置 `VITE_API_BASE_URL` 指向后端。

5) 访问

- 前端：`http://<本机IP>:5173`
- 后端健康检查：`http://<本机IP>:3001/health`（JSON 中含 `features.calendar` 等字段表示已为新版本 API）
- **若浏览器请求 `http://localhost:5173/api/calendar/...` 返回 `Cannot GET /api/calendar/...`（HTML）**：说明请求已被 Vite 转到后端，但 **3001 上跑的是旧版后端**。请在 **`fullstack/backend` 目录** 停止旧进程后执行 `npm run dev` 重启；并确认 `VITE_PROXY_TARGET`（若配置）指向该后端地址与端口。

新增/变更表结构后请执行：

- `db/migrations/003_booking_trip_window.sql`（预约「出差服务范围」字段）
- Adminer：`http://<本机IP>:8080`（系统 MySQL，服务器 `mysql` 或 `127.0.0.1`，用户名 `root`，密码 `root`，数据库 `sc_booking`）

### 环境变量

后端使用 `backend/.env`（示例见 `backend/.env.example`）。

常用配置项：

- 跨域（CORS）：默认允许任意来源；生产环境可设置 `CORS_ALLOW_ALL=0`，并用 `ALLOWED_ORIGINS` 填多个前端地址（逗号分隔）
- 数据库：`DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`
- JWT：`JWT_SECRET`
- 邮件通知（可选）：`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`
- Teams 通知（可选）：`TEAMS_WEBHOOK_URL`
- 阿里云短信（可选）：`ALIYUN_SMS_REGION` / `ALIYUN_SMS_ACCESS_KEY_ID` / `ALIYUN_SMS_ACCESS_KEY_SECRET` / `ALIYUN_SMS_SIGN_NAME` / `ALIYUN_SMS_TEMPLATE_CODE`

### 阿里云短信配置说明

- 在阿里云短信服务中创建短信签名与短信模板，并记录模板编码。
- 当前系统发送模板参数为：`{"content":"<预约通知正文>"}`，建议模板中包含变量 `${content}`。
- 若未配置阿里云短信参数，选择“手机号码”通知时会记录失败日志并提示配置缺失。

