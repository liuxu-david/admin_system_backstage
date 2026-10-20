# 基础设施手册：PostgreSQL 与 Redis（写给前端转全栈）

> 不预设你懂后端运维。每个概念先用一句话讲清"是什么"，再给"照抄的命令"，最后给"✅ 验证"。
> 一句话总览：**PG 存所有业务数据（硬资产），Redis 存缓存（丢了能自动重建）**。

## 0. 一分钟理解

| | PostgreSQL（简称 PG） | Redis |
|---|---|---|
| 是什么 | 关系型数据库，类似"能用 SQL 查询的多表 Excel" | 内存键值库，类似"贴在内存上的超快便签" |
| 本项目存什么 | 用户/角色/菜单/权限码/项目等**全部业务数据** | 两类缓存：用户权限集合、用户菜单树（30 分钟过期） |
| 数据丢了会怎样 | 💀 灾难（所以才有备份一说） | 无所谓，下次请求自动从 PG 重建 |
| 谁在连它 | 后端 NestJS（通过 TypeORM） | 后端 NestJS（通过 ioredis） |
| 端口 | 5432 | 6379 |

## 1. 本地开发：它们怎么来的

你本地**没有单独安装** PG/Redis——`docker-compose.yml` 里定义了两个容器，`docker-compose up -d postgres redis` 一键起。后端读 `.env.dev` 里的 `DB_*` / `REDIS_*` 去连接。

| 你想干什么 | 命令 |
|---|---|
| 起服务 | `docker-compose up -d postgres redis` |
| 停服务（**保留数据**） | `docker-compose stop` 或 `docker-compose down` |
| 停服务并**删除全部数据** ⚠️ | `docker-compose down -v`（新手别碰） |
| 看容器状态 | `docker ps`（看 STATUS 列 healthy） |
| 看日志 | `docker logs nest-postgres --tail 50` / `docker logs nest-redis --tail 50` |

> 数据存在 Docker 卷（`pg_data`/`redis_data`）里，容器删了重建数据也还在；只有 `down -v` 才连卷一起删。

## 2. 怎么"看到"里面的数据（前端同学最需要的部分）

**连 PG —— 方式 A：图形工具（推荐，像以前看接口返回值一样看表）**
用 DBeaver（免费）或 Navicat 新建连接：主机 `localhost`、端口 `5432`、用户 `postgres`、密码 `postgres`、库 `nest_backend_dev`。连上后展开 `public` 就能看到 users/roles/menus 等表。

**连 PG —— 方式 B：命令行**
```bash
docker exec -it nest-postgres psql -U postgres -d nest_backend_dev
```
进去后常用：`\dt`（看所有表）、`SELECT email,status FROM users;`（查数据）、`\q`（退出）。

**连 Redis**
```bash
docker exec -it nest-redis redis-cli
```
进去后常用：`KEYS *`（看所有 key）、`SMEMBERS user:perms:用户id`（看某人权限缓存）、`DEL user:menus:用户id`（删一个缓存）、`FLUSHDB`（清空本库全部缓存，改库后常用）。

## 3. 新测试部署：统一四容器，不单独安装数据库

详细步骤见 [deploy/README.md](../deploy/README.md)。只使用本仓库 `deploy/compose.yml`、`.env.example`、`manage.py`，人工上传到固定 `/opt/admin-system-test/`。旧 `docker-compose.deploy.yml` 与旧备份脚本已删除，**不要混用旧容器名、旧卷或旧备份脚本**。

服务器安装官方 Docker Engine、Compose 插件 2.20+ 或更新版本及 Python 3；不装业务 Node／pnpm，不执行构建。PG16、Redis7、后端 app、前端 web 在同一网络；仅 `127.0.0.1:8080` 发布到宿主，数据库端口不开放公网。

| 服务器 `.env` 字段 | 要求 |
|---|---|
| DB_USERNAME／DB_NAME | 首次可保留模板 `admin_test`／`admin_system_test`；初始化角色为超级用户，仅用于隔离测试 |
| DB_PASSWORD／REDIS_PASSWORD | 两组独立强随机值，**测试环境也必须设置** |
| JWT_ACCESS_SECRET／JWT_REFRESH_SECRET | 另外两组不同随机值，每项分别用 `openssl rand -hex 32` 生成 |
| CORS_ORIGINS | 默认 `http://127.0.0.1:18080`，用于本地 SSH 隧道 |

`.env` 仅服务器存储、权限600，不 source／eval；镜像另存工具生成的 `images.env`。工具按字面值传入 Compose，不手工执行默认 `docker compose up`。`APP_ENV=test` 仍只跑 migration，首次 seed 须交互终端，随后隧道登录并改默认密码。

## 4. 日常运维（服务器，同一部署用户）

| 场景 | 命令／操作 |
|---|---|
| 看期望版本、历史成功版本及实际容器 | `python3 /opt/admin-system-test/manage.py status` |
| 检查前端与代理 health | `python3 /opt/admin-system-test/manage.py check`；仍需人工登录验收 |
| 看后端日志 | `docker logs --tail=100 admin-system-test-app-1`（分享前脱敏） |
| 备份 PG | `python3 /opt/admin-system-test/manage.py backup`，保留输出的 `.dump` 文件 |
| 发布后端 | `python3 /opt/admin-system-test/manage.py deploy backend "完整后端digest"` |
| 回退后端镜像 | `python3 /opt/admin-system-test/manage.py rollback backend --confirm-schema-compatible` |

后端发布先备份PG，再重建app和web；跨仓库锁冲突立即拒绝，等前一操作结束并核对状态再重试。回滚**不恢复数据库**，必须先确认旧应用兼容当前结构。

备份需异地副本与隔离恢复演练，另备份实际上传文件和加密配置；没有自动定时备份／恢复保证。旧 `backup-db.sh`／`restore-db.sh` 已删除，恢复演练使用 `manage.py backup` 产物；不要运行删库脚本或 `down -v` 来排错。

## 5. 部署常见坑

| 现象 | 原因／处理 |
|---|---|
| 改库权限／菜单后页面不变 | 优先走管理接口自动失效缓存；直接改库需评估对应 key，部署环境不要照搬本地 FLUSHDB |
| 数据库密码错误 | 已初始化卷的账号密码不会随 `.env` 自动改变；需数据库内改密与应用配置协调 |
| Redis NOAUTH | `.env` 强密码与实际服务不一致；不要为了修复而取消认证 |
| 发布失败但 images.env 已变 | 这是期望版本，不是成功证明；结合status实际容器和历史，不能假称自动回滚 |
| 数据像清空了 | 先检查项目名、DB_NAME、旧／新数据卷，别删卷再bootstrap |
| 内存不足、备份占满磁盘 | 四容器限制约1280MiB不是容量保证；观察实际用量、备份验证后归档，不自动删全部旧文件 |
