# CI/CD 与部署（后端独立仓库版）

> 部署、流水线排障时读。前端是独立仓库独立流水线，见前端仓库 docs/ci-cd.md。

## 全景

```
MR/develop/main → check（tsc + eslint + 单测 + build）
develop 合入    → package（docker build → 推 GitLab Registry）→ deploy:test（自动）
main 合入       → deploy:staging（手动确认 ▶）
```

部署目标：服务器目录（如 `/opt/admin-backend-test`）里的 `docker-compose.deploy.yml`（app+postgres+redis）+ `.env`。容器启动时 entrypoint 自动 `migration:run`。

## 一次性准备

### 1. 建仓推送

```bash
cd admin_system_backstage
git init -b main
git add . && git commit -m "init"
git remote add origin git@你的gitlab:组名/admin-backend.git
git push -u origin main
git checkout -b develop && git push -u origin develop
```

### 2. GitLab：Registry + Runner

- 确认项目左侧 **Packages & Registries → Container Registry** 可用（自建 GitLab 需管理员开）。
- Runner：docker executor + **privileged**（dind 构建镜像需要）：

```bash
sudo gitlab-runner register --url https://gitlab.你的域名 --token glrt-xxx \
  --executor docker --docker-image docker:27 --docker-privileged
```

### 3. CI/CD Variables（项目 Settings → CI/CD → Variables）

| Key | 说明 |
|---|---|
| TEST_SSH_HOST / TEST_SSH_USER | 测试服务器 |
| TEST_SSH_KEY | 部署私钥全文 |
| TEST_DEPLOY_DIR | 如 /opt/admin-backend-test |
| STAGING_*（同上四件） | 预发（可与测试同机不同目录） |

私钥生成：本机 `ssh-keygen -t ed25519 -f deploy_key` → 公钥进服务器 `~/.ssh/authorized_keys`，私钥内容存变量。

### 4. 服务器（装 docker 后）

```bash
mkdir -p /opt/admin-backend-test && cd /opt/admin-backend-test
cat > .env <<'EOF'
DB_USERNAME=postgres
DB_PASSWORD=强密码
DB_NAME=nest_backend_test
REDIS_PASSWORD=
JWT_ACCESS_SECRET=$(openssl rand -hex 32 的结果)
JWT_REFRESH_SECRET=$(openssl rand -hex 32 的结果)
APP_BIND=127.0.0.1
APP_PORT=3000
EOF
chmod 600 .env
```

> `.env` 里不用配镜像地址——CI 部署时用 `$CI_REGISTRY_IMAGE:sha` 直接注入（`IMAGE` 变量）。跨机拉镜像需先 `docker login registry.你的域名`。

## 日常部署与验证

合入 develop 自动跑。手动验证：

```bash
curl http://127.0.0.1:3000/health                 # 服务器上
docker logs admin-app --tail 50                   # 排障
docker exec -it admin-app sh                      # 进容器
```

**首次部署后灌一次种子**（幂等）：

```bash
docker compose -f docker-compose.deploy.yml exec app node dist/database/seeds/rbac.seed.js
```

## 前后端怎么对接

- 后端 app 只绑宿主机 `127.0.0.1:3000`（`.env` 的 APP_BIND/APP_PORT 可改）。
- 前端仓库的 nginx 容器通过 `BACKEND_HOST`（默认 `host.docker.internal` = 宿主机）反代 `/api` 到这里。跨机部署把前端的 `BACKEND_HOST` 改成后端机器内网 IP。

## 排障速查

| 现象 | 处理 |
|---|---|
| package 阶段 docker login 失败 | Runner 没开 privileged 或 Registry 未启用 |
| 部署拉镜像 not found | 服务器没 `docker login` 你的 Registry |
| 健康检查失败 | `docker logs admin-app`：大概率 DB 连不上 / 迁移失败 |
| 迁移报 uuid_generate_v4 不存在 | 用了无扩展的老基线迁移，重新生成 |
