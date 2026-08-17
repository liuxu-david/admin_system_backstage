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

## 3. 部署环境（测试/预发）：你要做什么

**不用单独安装！** 部署编排 `docker-compose.deploy.yml` 自带 postgres/redis 服务，和后端一起拉起。你唯一要做的是在部署目录的 `.env` 里填这几个变量：

| 变量 | 干什么 | 怎么定 |
|---|---|---|
| DB_USERNAME | PG 管理员账号 | 固定 `postgres` |
| DB_PASSWORD | PG 密码 | 服务器上执行 `openssl rand -hex 16` 生成强密码 |
| DB_NAME | 库名 | 如 `nest_backend_test`（首次启动自动创建） |
| REDIS_PASSWORD | Redis 密码 | 测试可不填；**预发/生产必填**（填了 Redis 自动开启密码校验） |

安全设计（已做好，知悉即可）：部署环境 PG **不对外暴露端口**（只有后端容器内网能连），外面想连得改 compose 里的 ports 注释；Redis 同理。

**改配置生效方式**：改 `.env` 后在部署目录执行 `docker compose -f docker-compose.deploy.yml up -d`（会重建相关容器）。

## 4. 日常运维速查（部署环境，`/opt/admin-backend-test` 目录下执行）

| 场景 | 命令 |
|---|---|
| 看三个容器状态 | `docker ps` |
| 看后端日志 | `docker logs admin-app --tail 100` |
| 只重启后端（不动数据库） | `docker compose -f docker-compose.deploy.yml restart app` |
| 进 PG 查数据 | `docker exec -it admin-postgres psql -U postgres -d nest_backend_test` |
| 备份 PG（手动） | `docker exec admin-postgres pg_dump -U postgres nest_backend_test > backup_$(date +%m%d).sql` |
| 恢复备份 | `docker exec -i admin-postgres psql -U postgres nest_backend_test < backup_xxxx.sql` |
| 清 Redis 缓存 | `docker exec admin-redis redis-cli FLUSHDB`（设了密码加 `-a 密码`） |
| 定时自动备份 | `crontab -e` 加：`0 3 * * * cd /opt/admin-backend-test && docker exec admin-postgres pg_dump -U postgres nest_backend_test > /root/backup/$(date +\%m\%d).sql` |

## 5. 常见坑（全是本项目真实踩过的）

| 现象 | 原因 / 解法 |
|---|---|
| 改了库里的权限/菜单，页面不变 | Redis 缓存 30 分钟。走管理界面改会**自动清缓存**；直接改库必须手动 `FLUSHDB`（见上表） |
| 后端起不来，日志报 connection refused / 密码错误 | PG 容器没起（`docker ps` 看），或 `.env` 的 DB_PASSWORD 和创建容器时不一致 |
| Redis 报 NOAUTH | Redis 设了密码但 `.env` 的 REDIS_PASSWORD 没填/填错，两边必须一致 |
| 想清空重来 | `docker compose -f docker-compose.deploy.yml down -v` 删数据卷 → `up -d` → 重跑 seed（测试环境专用招） |
| 备份文件越来越大 | PG 备份含全部数据属正常；保留最近 7 天即可：`find /root/backup -mtime +7 -delete` |
