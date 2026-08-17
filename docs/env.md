# 环境变量速查

> 配置 env / 排查连不上时读。所有变量的唯一注册入口是 `src/config/configuration.ts`（业务代码不直接读 process.env）。

## 加载机制

- 按 `APP_ENV` 读 `.env.dev` / `.env.test` / `.env.prod`（缺省 dev）
- 容器部署时全部走环境变量注入（docker-compose `environment:`），优先级高于 .env 文件
- **仓库里的 .env.* 是模板（开发默认值）；真实密钥只写在服务器部署目录的 .env**（见 docs/ci-cd.md）

## 变量表

| 变量 | 默认 | 说明 |
|---|---|---|
| APP_ENV | dev | dev / test / prod。**决定 synchronize 开关（仅 dev）和 CORS 策略** |
| APP_PORT / APP_PREFIX | 3000 / api | 监听端口 / 全局路由前缀 |
| DB_HOST / DB_PORT | localhost / 5432 | 容器内是 `postgres`（compose 服务名） |
| DB_USERNAME / DB_PASSWORD | postgres / postgres | 容器部署必须改强密码 |
| DB_NAME | nest_backend | dev 库 nest_backend_dev；测试库 nest_backend_test；迁移对照库 nest_migrated |
| DB_LOGGING | false | SQL 日志，排障时开 |
| REDIS_HOST / REDIS_PORT | localhost / 6379 | 容器内是 `redis` |
| REDIS_PASSWORD | 空 | dev 可空；**预发/生产必填**（compose 里设了就自动 requirepass） |
| REDIS_DB | 0 | |
| JWT_ACCESS_SECRET / JWT_REFRESH_SECRET | change-me-* | **上服务器必须换强随机值**（`openssl rand -hex 32`）。换密钥 = 所有已发 token 失效 |
| JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN | 15m / 7d | access 过期前端自动用 refresh 无感续期 |
| CORS_ORIGINS | 空 | 逗号分隔的白名单（如 `https://staging-admin.x.com`）。空 = dev/test 放开、prod 关闭 |
| RUN_MIGRATIONS | - | 容器专用：true 时 entrypoint 启动前自动 `migration:run` |
| MAIL_* / SMS_* / FILE_STORAGE_* | 见 configuration.ts | 邮件（SMTP）/ 短信（mock）/ 文件存储（local），暂未投入使用 |

## 各环境一览

| 环境 | APP_ENV | DB | synchronize | 迁移 | 密钥 |
|---|---|---|---|---|---|
| 本地 dev | dev | nest_backend_dev（docker） | ✅ 自动 | 不需要（可选对照库用） | 模板默认 |
| 测试 | test | nest_backend_test（服务器） | ❌ | 容器自动跑 | 服务器 .env |
| 预发 | prod 同级 | 独立库 | ❌ | 容器自动跑 | 全部强随机 + Redis 密码必填 |
