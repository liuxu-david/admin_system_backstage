# CI/CD 与部署手册（运维小白版·后端）

> 目标：从上往下照着做，做完后「推代码到 GitLab → 测试服务器自动更新」全链路打通。
> 现状：代码存 GitHub；CI/CD 和部署用**自建 GitLab**（代码要再推一份过去，两边不冲突）。
> 前端是独立仓库，公共设施（本篇第 1、2 节）搭好后前端直接复用，见前端仓库 docs/ci-cd.md。
> 每个命令块下面都有「✅ 验证」，能对上就说明这步成了，再走下一步。

## 0. 全景：需要准备的四样东西

| # | 东西 | 是什么 | 放哪 |
|---|---|---|---|
| 1 | Linux 服务器 | 真正跑你后端+数据库的机器（2核4G 起） | 云上买 |
| 2 | GitLab 实例 | 自建的公司代码平台，负责跑流水线、存 Docker 镜像 | 一台机器（可与 1 同台，建议内存≥4G） |
| 3 | GitLab Runner | 干活的工人，GitLab 派任务给它（检查代码/打镜像） | 装在 1 或 2 上 |
| 4 | Container Registry | GitLab 自带的镜像仓库 | GitLab 自带，配置开启即可 |

```
你 push 代码到 GitLab → Runner 自动：检查(tsc/测试) → 打 Docker 镜像推到 Registry
→ SSH 到服务器 docker compose pull + 重启 → curl /health 确认活着
```

> **PG 和 Redis 不需要单独安装**——部署编排自带这两个容器，跟后端一起拉起，你要做的只是在 `.env` 里填好连接密码（第 3 节）。
> 它们是什么、怎么连进去看数据、怎么备份/清缓存，见同目录 **[infra.md](infra.md)**（写给前端转全栈的基础设施手册）。

## 1. 准备 Linux 服务器（一次性）

```bash
ssh root@服务器IP                       # 云厂商控制台拿 IP 和密码
curl -fsSL https://get.docker.com | sh  # 装 Docker（含 compose 插件）
```
✅ 验证：`docker -v` 出版本号，`docker compose version` 出版本号。

**（可选）这台机上直接装 GitLab**——公司已有 GitLab 就跳过这步：
```bash
# 装法A：apt 安装（官方源）
curl -s https://packages.gitlab.com/install/repositories/gitlab/gitlab-ce/script.deb.sh | sudo bash
sudo EXTERNAL_URL="http://gitlab.你的IP" apt install gitlab-ce
# 装法B：docker 跑（机器上已有 docker 时更省心）
docker run -d --name gitlab --hostname gitlab.你的IP -p 80:80 -p 2222:22 \
  -v /srv/gitlab/config:/etc/gitlab -v /srv/gitlab/logs:/var/log/gitlab \
  -v /srv/gitlab/data:/var/opt/gitlab --restart always gitlab/gitlab-ce:latest
```
✅ 验证：浏览器打开 `http://gitlab.你的IP` 能看到登录页；首次 root 密码在服务器 `/etc/gitlab/initial_root_password`（24h 内有效，登录后改掉）。

## 2. GitLab 侧准备（一次性）

1. **建项目**：GitLab 建组（如 `admin`）→ 新建空项目 `admin-backend`（**不要**勾选 Initialize with README）。
2. **推代码**（在你电脑的项目目录）：
   ```bash
   git remote add gitlab http://gitlab.你的IP/admin/admin-backend.git
   git push gitlab main            # 顺便把 develop 也推上去：git push gitlab develop
   ```
3. **开 Registry**（apt 装法）：编辑 `/etc/gitlab/gitlab.rb` 加一行 `registry_external_url "http://gitlab.你的IP:5050"`，然后 `sudo gitlab-ctl reconfigure`。
   ✅ 验证：项目左侧出现 **Packages & Registries → Container Registry** 且能打开。
4. **装并注册 Runner**（在服务器上）：
   ```bash
   curl -L https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh | sudo bash
   sudo apt install gitlab-runner
   # token 在 GitLab 项目 → Settings → CI/CD → Runners → 点"New project runner"生成
   sudo gitlab-runner register --url http://gitlab.你的IP --token glrt-xxxx \
     --executor docker --docker-image docker:27 --docker-privileged
   ```
   （`--docker-privileged` 必须带：流水线里要构建 Docker 镜像，没权限会失败）
   ✅ 验证：Settings → CI/CD → Runners 页面，你的 runner 显示绿点 Online。
5. **配 SSH 部署密钥**（让流水线能登录服务器执行命令）：
   ```bash
   # 你电脑上生成一对密钥（一路回车）
   ssh-keygen -t ed25519 -f deploy_key -N ""
   cat deploy_key.pub >> root@服务器:~/.ssh/authorized_keys   # 公钥放服务器
   ```
6. **配 CI 变量**：GitLab 项目 → Settings → CI/CD → Variables → 逐个 Add：

| 变量名 | 值 | 说明 |
|---|---|---|
| TEST_SSH_HOST | 服务器IP | 测试服务器 |
| TEST_SSH_USER | root | 登录账号 |
| TEST_SSH_KEY | deploy_key 文件的**全部内容** | Type 选 Variable |
| TEST_DEPLOY_DIR | /opt/admin-backend-test | 服务器上的部署目录 |

7. **服务器上登录 Registry**（拉镜像要凭证）：GitLab 项目 → Settings → Repository → Deploy tokens → 新建（勾 `read_registry`），拿到用户名/密码后在服务器执行：
   ```bash
   docker login gitlab.你的IP:5050 -u 部署token用户名 -p 部署token密码
   ```

## 3. 服务器上准备部署目录（每环境一次）

```bash
mkdir -p /opt/admin-backend-test && cd /opt/admin-backend-test
cat > .env <<'EOF'
DB_USERNAME=postgres
DB_PASSWORD=改成一个强密码
DB_NAME=nest_backend_test
REDIS_PASSWORD=
JWT_ACCESS_SECRET=换强随机值（ssh上执行 openssl rand -hex 32 生成）
JWT_REFRESH_SECRET=再生成一个不同的
APP_BIND=127.0.0.1
APP_PORT=3000
EOF
chmod 600 .env
```
> `.env` 是这台环境的真实密码，**不进 git**；compose 文件由流水线每次部署自动同步过去。
> PG/Redis 各变量的含义与安全说明见 [infra.md](infra.md) 第 3 节。

## 4. 第一次部署

```bash
# 你电脑上：切到 develop 推一下（或提个 MR 合入 develop）
git checkout develop && git push gitlab develop
```
→ GitLab 项目 → Build → Pipelines 看流水线跑：check → package → deploy:test 全绿。
✅ 验证：服务器上 `curl http://127.0.0.1:3000/health` 返回 `{"code":0,...}`。

**首次灌一次种子数据**（角色/权限/菜单/admin 账号，幂等可重复跑）：
```bash
cd /opt/admin-backend-test && docker compose -f docker-compose.deploy.yml exec app node dist/database/seeds/rbac.seed.js
```

## 5. 日常怎么用

| 想干什么 | 怎么做 |
|---|---|
| 日常开发 | `feature/xxx` 分支 → GitLab 提 MR → 合入 `develop` → 自动部署测试环境 |
| 上预发 | `develop` 合入 `main` → 流水线出现手动按钮 ▶ `deploy:staging`，点一下才部署 |
| 改了表结构 | 本地生成迁移文件（见 docs/conventions.md）随代码一起合入，容器启动自动执行 |
| 看服务日志 | 服务器 `docker logs admin-app --tail 100` |

## 6. 常见问题

| 现象 | 原因/处理 |
|---|---|
| 流水线一直 pending | Runner 没注册成功或离线：回第 2.4 步；服务器上 `sudo gitlab-runner status` |
| package 阶段 docker login 失败 | Runner 注册时没带 `--docker-privileged`，重新注册 |
| deploy 阶段拉镜像 not found | 服务器没做第 2.7 步的 docker login，或 Registry 地址/端口对不上 |
| 健康检查失败 | `docker logs admin-app --tail 50`：大概率 .env 里 DB 密码和实际不一致 |
| 接口 401 全挂 | 换过 JWT 密钥——所有已登录用户 token 失效，重新登录即可 |

## 7. 上预发前 checklist

独立目录（`/opt/admin-backend-staging`）+ 独立 .env（全新强密码、Redis 必须设密码、CORS_ORIGINS 设预发域名）；部署后**立即改掉 seed 的 admin 弱密码**；域名+HTTPS 挂外层 nginx/云负载均衡；`crontab` 加 PG 每日 `pg_dump` 备份。
