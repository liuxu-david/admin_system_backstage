# 后端 CI/CD：GitHub Actions 与隔离测试环境

> 实施文件已在本地；未提交／推送不等于 GitHub 已启用。完整亲手操作教程：[deploy/README.md](../deploy/README.md)。
> 并列工作区也可读 [根 DEPLOY.md](../../DEPLOY.md)；父目录不是 Git 仓库，该根教程不随本仓库上传。

## 1. 入口与默认行为

工作流：[`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml)。仓库 origin 为 `liuxu-david/admin_system_backstage`，工作分支 `chore/github-actions-test` 待用户 review／commit／push／PR 到 main。

| 事件 | 行为 |
|---|---|
| PR 到 main | 检查、构建、隔离 smoke；不推镜像、不部署 |
| push main | 检查后推 GHCR；默认不部署 |
| workflow_dispatch | 选择 main 且 `deploy=true` 才显式部署 |
| 仓库 Actions variable `AUTO_DEPLOY_TEST=true` | 允许 push main 自动部署；首次 bootstrap 前保持 false／不设 |

部署 job 使用 Environment `test`，仅 main，权限只有 `contents:read`。main 的镜像 job 用 `GITHUB_TOKEN`＋`packages:write` 推包；不把服务器数据库密码给 PR。

## 2. 实际检查与镜像

标准 `ubuntu-24.04` Runner，Node `24.19.0`（`.nvmrc`）、pnpm `11.20.0`。使用官方 npm registry 和冻结锁文件安装，不使用带 `--fix` 的 lint 快捷命令。

```bash
pnpm exec eslint "{src,test}/**/*.ts"
pnpm exec tsc --noEmit -p tsconfig.json
pnpm test --runInBand
pnpm build
pnpm audit --prod --audit-level=high --registry=https://registry.npmjs.org
python3 -m unittest discover -s .github/scripts -p 'test_*.py' -v
python3 -m unittest discover -s deploy -p 'test_*.py' -v
```

另检查 Compose 配置，Docker 镜像在独立临时 PG16／Redis7 中验证 migration、health、注册、登录、用户信息；不接真实测试服务器或运行其 seed。只有通过 smoke 的**同一镜像**会被推送，不二次构建替换产物。

镜像标签为 `ghcr.io/liuxu-david/admin_system_backstage:sha-完整提交SHA`；运行 Summary 的 **Backend test image** 输出完整 `ghcr.io/liuxu-david/admin_system_backstage@sha256:64位小写十六进制`。实际部署只接受 digest，不接受 tag／latest，不要与前端引用混用。

仅 `linux/amd64`，服务器须为 x86_64；尚未实现 ARM 多架构。主机不需要安装 Node、pnpm、PM2 或构建 Runner。

## 3. 服务器目录和秘密

新测试统一使用本仓库 `deploy/compose.yml`、`.env.example`、`manage.py`，人工 SFTP 上传到固定 `/opt/admin-system-test/`。CI 不同步／覆盖这些文件，不支持 DEPLOY_DIR 自定义。

四个服务：`web` → `app:3000` → `postgres:5432`／`redis:6379`；同一 Compose 网络，只发布 `127.0.0.1:8080`。默认用个人电脑 SSH 隧道 `127.0.0.1:18080` 访问。

- 安装官方 Docker APT＋Compose 插件 2.20+ 或更新版本、Python 3；Python 只用于管理脚本。
- `.env` 在服务器由模板复制，四个秘密独立生成，chmod 600；不要提交 GitHub、source／eval 或打印完整展开配置。
- 工具按字面值读取 `.env`，受控传给 Compose；镜像单独保存为 `images.env`，不是秘密配置的一部分。
- `APP_ENV=test`、`RUN_MIGRATIONS=true`、`SEED_SYNCHRONIZE=false` 固定在编排，test 仍只走 migration。
- PG 初始化账号为超级用户，仅用于本隔离测试，不是生产最小权限设计。
- 私有 GHCR 使用对两包均有 Read 的账号＋PAT classic `read:packages`，在同一部署用户下 `docker login --password-stdin`；不使用 sudo 登录另一账号。

## 4. 首次启动、seed 与发布命令

在 main 成功构建两镜像、配置服务器 `.env` 和只读 GHCR 登录后，服务器部署用户执行：

```bash
read -r -p "后端完整 digest: " BACKEND_IMAGE
read -r -p "前端完整 digest: " FRONTEND_IMAGE
python3 /opt/admin-system-test/manage.py bootstrap "$BACKEND_IMAGE" "$FRONTEND_IMAGE"
python3 /opt/admin-system-test/manage.py status
python3 /opt/admin-system-test/manage.py check
python3 /opt/admin-system-test/manage.py seed
```

bootstrap 失败先定位后可重试；成功后不再允许 bootstrap。seed 只在交互终端执行，显示警告后直接运行，不自动 CI、不另外等待输入确认；输出初始凭据须保密。随即通过 SSH 隧道登录并在用户管理修改默认密码。不要执行开发 `pnpm seed`。

日常命令（替换 IMAGE 为本仓库成功 Summary 的完整 digest）：

```bash
python3 /opt/admin-system-test/manage.py deploy backend "$IMAGE"
python3 /opt/admin-system-test/manage.py backup
python3 /opt/admin-system-test/manage.py rollback backend --confirm-schema-compatible
```

deploy／rollback 需要已有成功 bootstrap。后端更新先拉取／备份 PG，再重建 app 和 web，避免 Nginx 使用旧 IP。跨仓库 fcntl 锁冲突直接拒绝，等前一操作结束并核对状态再重试。历史保存到 `release-history.json`。

回滚只回退应用，**不恢复数据库**；参数表示操作者已经确认结构兼容。失败可能已有容器替换／迁移，不伪称自动回滚；`images.env` 只是期望状态，结合 status 的实际容器与历史看。

## 5. 自动 SSH 配置

两仓 GitHub Environment **test** 只允许 main；可用时设置审批。环境 Variables：`DEPLOY_HOST`（私网 IPv4／DNS）、`DEPLOY_PORT`、`DEPLOY_USER`、`USE_TAILSCALE`、`TAILSCALE_TAGS=tag:ci`。Secrets：`DEPLOY_SSH_KEY`、`DEPLOY_KNOWN_HOSTS`；启用 Tailscale 时另加 `TS_OAUTH_CLIENT_ID`、`TS_OAUTH_SECRET`。

只有 `USE_TAILSCALE=true` 启用官方 Action v4.2.0 OAuth。服务器先用正常账号接入，OAuth 要 **auth_keys Write**、拥有或匹配 tag:ci，ACL 仅允许 CI 到服务器 SSH，不覆盖整个已有策略；不需要 `id-token:write`。不启用时须自备安全可达 SSH 通道，不默认开放全公网。详见 [官方要求](https://github.com/tailscale/github-action/blob/v4.2.0/README.md)。

CI 公钥追加到部署用户 authorized_keys；私钥交给 Secret。ssh-keyscan 只采集主机公钥，须通过云控制台对比 SHA256 指纹后才保存 known_hosts，不关闭校验。完整安装／核验步骤见长手册。

`AUTO_DEPLOY_TEST` 是**仓库级**变量，不是仅放环境的变量。先手动 main `deploy=true` 验收，再按需开启自动。

## 6. 运维与验证边界

推荐 `manage.py status/check/backup`；日志在服务器可用 `docker logs --tail=100 admin-system-test-app-1`。手工 Compose 默认不读 images.env，不要误用普通 `docker compose up`。

旧 `docker-compose.deploy.yml`、backup-db.sh／restore-db.sh 已删除；两仓旧 `.gitlab-ci.yml` 已移除。不要删卷恢复；备份需异地副本及隔离恢复演练。四容器限制合计约1280MiB，不保证2GB容量；单实例发布可短暂中断。

本机已通过双方类型／build、后端29测试；eslint 0error／104既有warning。生产依赖 audit high 门槛通过，后端仍3 moderate，前端0漏洞。actionlint／Compose静态检查、客户端mock测试后端9／前端8通过。管理工具50项中49实跑、1项Windows真实flock跳过。

真实独立 PG16／Redis7＋宿主Node24编译产物的迁移／登录链路通过，**不是新镜像验证**。双端 Docker build 在 Docker Hub匿名token网络请求超时；镜像smoke、GitHub Actions、GHCR及真实服务器发布未实际完成。后续须用户跑绿，免费额度／私有包权限也须实际账户确认。
