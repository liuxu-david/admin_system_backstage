# 在一台 Ubuntu 服务器部署测试环境（可独立阅读）

本教程随**后端仓库**保存，前端仓库使用同一套服务器配置。完整工作区另有根 `DEPLOY.md`，但父目录不是 Git 仓库，GitHub 不会自动包含它。

**当前是本地实施，不是已云端启用。** 两仓工作分支 `chore/github-actions-test` 待用户 review／commit／push／PR。默认 main 只构建并推镜像，首次部署须人工完成，之后才选择自动部署。验证边界见第 10 节。

## 1. 先理解顺序与三个操作位置

| 位置 | 用什么 | 做什么 |
|---|---|---|
| 本地 | Windows Git Bash／编辑器 | 审核和推送、生成 SSH key、打开隧道 |
| GitHub | 浏览器的两个仓库页面 | PR、Actions、Summary、Variables／Secrets |
| 服务器 | MobaXterm 的 Ubuntu SSH 终端 | 安装 Docker、SFTP 文件、填写配置、启动维护 |

| 组件 | 仓库 | 镜像名（注意前后端不同） |
|---|---|---|
| 后端 | [liuxu-david/admin_system_backstage](https://github.com/liuxu-david/admin_system_backstage) | `ghcr.io/liuxu-david/admin_system_backstage` |
| 前端 | [liuxu-david/admin_system_front](https://github.com/liuxu-david/admin_system_front) | `ghcr.io/liuxu-david/admin_system_front` |

先让两仓 main 构建 → 准备服务器 → 上传本目录三个文件 → 填秘密／登录 GHCR → bootstrap／seed → 隧道登录改密 → 可选自动 SSH 发布。

服务器仅运行 web（Nginx）、app、PostgreSQL16、Redis7 四容器；Python3仅用于管理脚本，不是业务运行时。不装 PM2、Node／pnpm、GitLab、Jenkins、自托管 Runner，不在服务器编译。

## 2. 审核提交，取得两个正确的 digest

**本地 Git Bash：** 两个目录各自是独立 Git 仓库，先确认现有修改：

```bash
git -C /d/liuxu/admin_system_project/admin_system_backstage status --short
git -C /d/liuxu/admin_system_project/admin_system_front status --short
```

在编辑器分别打开仓库，检查分支 `chore/github-actions-test` 和上表 origin；逐个审核并暂存本次文件，不直接 `git add .`，不要混入个人 `.env`、私钥或旧未跟踪备份脚本。保留原用户修改。确认暂存区后分别执行：

```bash
git -C /d/liuxu/admin_system_project/admin_system_backstage diff --cached --stat
git -C /d/liuxu/admin_system_project/admin_system_backstage commit -m "ci: add GitHub Actions test deployment"
git -C /d/liuxu/admin_system_project/admin_system_backstage push -u origin chore/github-actions-test
git -C /d/liuxu/admin_system_project/admin_system_front diff --cached --stat
git -C /d/liuxu/admin_system_project/admin_system_front commit -m "ci: add GitHub Actions test deployment"
git -C /d/liuxu/admin_system_project/admin_system_front push -u origin chore/github-actions-test
```

**GitHub 网页，两仓各操作一次：**

1. Settings → Actions → General 确认所用 Actions 可运行；不需要把所有工作流默认权限改成写。
2. Settings → Secrets and variables → Actions → Variables：`AUTO_DEPLOY_TEST` 保持不存在或小写 `false`。首次完成前不勾选手动部署。
3. 创建 PR，base 选择 main；等检查通过，review 后合并。PR 检查、构建与隔离 smoke，不发布镜像／部署。
4. 合并后打开 main 的 Actions 运行。check、image 应成功，deploy 默认跳过。
5. 在运行 Summary 的 **Backend test image**／**Frontend test image** 段，分别复制完整镜像引用。

引用必须是 `ghcr.io/对应仓库@sha256:`＋**64位小写十六进制**，不能包含反引号、不能截断或前后端混用。`sha-完整提交SHA` 是追踪标签，**不是部署参数**；管理工具拒绝 tag 和 latest。

**验证：** 两条引用均来自成功 main 运行，GHCR 包存在。工作流用标准 ubuntu-24.04、Node24.19.0、pnpm11.20.0；只推送已 smoke 的同一镜像，镜像成功不等于服务器已部署。

## 3. 服务器安装与部署用户

**服务器，用已有 sudo 管理账号。** 新测试仅支持 x86_64（linux/amd64）；若 `uname -m` 是 aarch64 就停止，当前没有自动 ARM 多架构。发现已有部署／数据时先盘点备份，不能覆盖重来。

```bash
cat /etc/os-release
uname -m
free -h
df -h
docker --version
docker compose version
```

需要 Docker Engine、**Compose 插件 2.20+ 或更新版本**（支持 up --wait／--wait-timeout，不是旧 docker-compose v1）、Python3。已有合适 Docker 不重复安装。新 Ubuntu 按[官方说明](https://docs.docker.com/engine/install/ubuntu/)检查支持版本和冲突包后：

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl python3 openssl nano
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
docker compose version
python3 --version
curl -I https://ghcr.io/v2/
```

**验证：** hello-world 和工具版本成功；GHCR 401 表示到达认证入口，不代表已能拉私有包。DNS／TLS／超时先解决，不能关 TLS 校验。上面加载的是系统 `/etc/os-release`，**项目 `.env` 不允许 source／eval**。

安全组仅保留可信人工 SSH 来源，不开公网80／443／8080／3000／5432／6379／5173；Docker端口可能绕过普通UFW，须同时检查Compose绑定地址。测试入口仅server `127.0.0.1:8080`。

创建专用用户（若已存在先核实用途，不重复创建）：

```bash
sudo adduser --disabled-password --gecos "" admin-deploy
sudo usermod -aG docker admin-deploy
sudo install -d -m 750 -o admin-deploy -g admin-deploy /opt/admin-system-test
sudo install -d -m 700 -o admin-deploy -g admin-deploy /home/admin-deploy/.ssh
```

Docker组接近root权限，必须保护账号和key，不能chmod777或改整个/opt权限。

**本地 Git Bash：** 新建个人操作key时设置口令；已有合适个人key可继续使用，不覆盖文件：

```bash
ssh-keygen -t ed25519 -C "admin-test-operator" -f ~/.ssh/admin-test-operator
cat ~/.ssh/admin-test-operator.pub
```

**服务器管理账号：** 把刚才公钥的完整一行替换下方引号内容，不是私钥：

```bash
printf '%s\n' '替换为个人公钥完整一行' | sudo tee -a /home/admin-deploy/.ssh/authorized_keys > /dev/null
sudo chown admin-deploy:admin-deploy /home/admin-deploy/.ssh/authorized_keys
sudo chmod 600 /home/admin-deploy/.ssh/authorized_keys
```

通过云厂商可信网页终端运行 `sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`，与首次SSH显示的SHA256指纹核对，一致才确认连接。**本地新开终端**：

```bash
ssh -i ~/.ssh/admin-test-operator -p 22 admin-deploy@你的服务器管理地址
```

22换真实端口，后续服务器命令全部用同一个 `admin-deploy`，包括 Docker 登录；不要用 sudo docker login 换成root。执行 `whoami`、`id -nG`、`docker ps` 验证账号、docker组和权限；组未生效就重新登录。

## 4. SFTP上传配置，只在服务器填秘密

MobaXterm用admin-deploy新建SSH会话，选择个人key。左侧SFTP进入固定 **`/opt/admin-system-test/`**，从后端本目录只上传：

- `compose.yml`
- `.env.example`（显示隐藏文件）
- `manage.py`

不上传源码、node_modules、个人.env或旧脚本。CI不会同步这些文件；不支持DEPLOY_DIR自定义。以后更新也先审核再SFTP，不覆盖服务器秘密、历史和镜像状态。

**服务器admin-deploy：**

```bash
ls -la /opt/admin-system-test
python3 /opt/admin-system-test/manage.py --help
cd /opt/admin-system-test
test ! -e .env && cp .env.example .env
chmod 600 .env
openssl rand -hex 32
nano .env
```

.env若已存在，复制失败是保护，不覆盖。nano保存Ctrl+O、回车，退出Ctrl+X。每个秘密单独重新执行一次openssl，四项不得共用：

| 字段 | 填写要求 |
|---|---|
| DB_NAME／DB_USERNAME | 首次可保留admin_system_test／admin_test；以后不要随意改 |
| DB_PASSWORD／REDIS_PASSWORD | 两组独立随机值，测试也必须填 |
| JWT_ACCESS_SECRET／JWT_REFRESH_SECRET | 另外两组不同随机值 |
| CORS_ORIGINS | 保留 `http://127.0.0.1:18080` |
| BACKEND_REPOSITORY | `ghcr.io/liuxu-david/admin_system_backstage` |
| FRONTEND_REPOSITORY | `ghcr.io/liuxu-david/admin_system_front` |

只写单行KEY=value，不加export、命令替换或行尾注释；建议用上述十六进制随机值。秘密至少32字符，模板占位值会被拒绝。`APP_ENV=test`固定在编排，仍只走migration，禁止synchronize。PG初始化账号是超级用户，仅用于隔离测试，不是生产最小权限方案。

镜像不填.env，工具另生成 `images.env`，历史为 `release-history.json`。不source／eval、不把秘密上传GitHub／前端VITE_／公开截图。已初始化PG卷的密码不会随.env自动改变，改密须另行协调数据库与应用。

**验证：** 三文件齐全，help正常，`ls -l .env`是600权限，四秘密已独立替换。不要打印完整配置验证秘密。

## 5. 服务器只读登录GHCR

**GitHub网页：** 用对两个GHCR包均有Read权限的账号，个人Settings → Developer settings → Personal access tokens → Tokens(classic)，创建有期限、仅需 **read:packages** 的token。包若不继承仓库权限，到各包Package settings确认Read；组织如要求SSO，对token授权。私有仓库无需公开。

**服务器admin-deploy：**

```bash
read -r -p "GitHub用户名: " GHCR_USER
read -r -s -p "只读PAT: " GHCR_TOKEN; printf '\n'
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
unset GHCR_TOKEN GHCR_USER
```

验证 `Login Succeeded`。不把token放命令参数；Docker认证文件没有credential helper时不是加密保险箱，要保护该用户HOME。CI SSH也是此用户，才能使用同一拉包授权。

CI推包使用GitHub自动提供的GITHUB_TOKEN（镜像job packages:write）；服务器PAT不用来推包，部署job只contents:read。

## 6. 首次启动、初始化与隧道登录

**服务器admin-deploy：** 从第2节Summary复制两个完整digest，输入不带反引号：

```bash
read -r -p "后端完整digest引用: " BACKEND_IMAGE
read -r -p "前端完整digest引用: " FRONTEND_IMAGE
python3 /opt/admin-system-test/manage.py bootstrap "$BACKEND_IMAGE" "$FRONTEND_IMAGE"
python3 /opt/admin-system-test/manage.py status
python3 /opt/admin-system-test/manage.py check
```

后端入口自动migration，再启动服务。bootstrap失败须先排障后可重试；成功后拒绝再次bootstrap，日常改用deploy。不要删历史绕过保护。check验证前端HTML和经Nginx的health，**不完整覆盖数据库、Redis和权限业务**。

首次手工seed：

```bash
python3 /opt/admin-system-test/manage.py seed
```

只允许交互受控终端，显示风险提示后执行，**没有额外输入确认**；CI不运行。保护默认凭据输出，不贴日志。重复seed会重设部分角色／菜单，不能每次发布都跑；不要用开发pnpm seed／migration:run。

**本地Git Bash新窗口：**

```bash
ssh -i ~/.ssh/admin-test-operator -p 22 -N \
  -L 127.0.0.1:18080:127.0.0.1:8080 admin-deploy@你的服务器管理地址
```

保持此窗口，浏览器访问 **http://127.0.0.1:18080**，不换localhost／公网IP。用seed账号登录，在用户管理改默认密码，退出再用新密码登录。验证菜单、用户／角色／项目查询和内部页刷新；上传文件另验收。

关闭隧道只断开本地访问，不停止容器。HTTP走加密SSH隧道，不允许改成公网明文登录。此时“自动构建＋人工发布”已可使用，不必立刻配置CD。

## 7. 可选自动CD：私网、专用key和test环境

### 7.1 Tailscale安全通道

默认不接入Tailscale；只有环境变量USE_TAILSCALE=true才用官方Action。不开时须自备托管Runner能安全到达的SSH通道，你电脑能连不证明CI能连，不放开0.0.0.0/0来凑通路。

1. 按[Tailscale Linux官方说明](https://tailscale.com/download/linux)安装服务器客户端，用正常账号接入tailnet。
2. 管理员先备份现有策略，建立tag:server／tag:ci的tagOwner，保留人工管理通道；在**现有策略中合并**CI仅到服务器SSH的限制，不覆盖整份ACL。例如实际SSH22时的相关片段：

```jsonc
"tagOwners": { "tag:ci": ["autogroup:admin"], "tag:server": ["autogroup:admin"] },
"grants": [ { "src": ["tag:ci"], "dst": ["tag:server"], "ip": ["tcp:22"] } ]
```

权限会叠加，窄规则不能抵消原全网允许规则，管理员须检查原宽泛权限并做策略测试。非22端口同步修改，不误断自己的连接。
3. 服务器管理终端执行 `sudo tailscale up --advertise-tags=tag:server`，再用 `tailscale status`、`tailscale ip -4`确认节点和私网地址；防火墙允许受限私网接口的SSH。
4. 创建专用OAuth client，按[官方v4.2.0说明](https://github.com/tailscale/github-action/blob/v4.2.0/README.md)给予 **auth_keys Write**（不是devices Write），关联tag:ci，凭据tag必须拥有或匹配请求tag。复制ID与secret到环境Secrets。

此方案是普通OpenSSH，不要求开启Tailscale SSH；临时CI节点联网后仍需公钥＋known_hosts。不用id-token:write；官方Action使用Node24、要求runner≥2.237.1，标准托管Runner可用。账号功能／费用要自行确认。

### 7.2 专用CI公钥和主机身份

**本地Git Bash：** 不覆盖同名key，也不共享个人私钥给CI：

```bash
ssh-keygen -t ed25519 -C "github-actions-admin-test" -f ~/.ssh/admin-test-ci -N ""
cat ~/.ssh/admin-test-ci.pub
```

**服务器admin-deploy：** 追加刚生成的公钥完整一行，不覆盖个人key：

```bash
printf '%s\n' '替换为CI公钥完整一行' >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
ssh-keyscan -p 22 -t ed25519 你的DEPLOY_HOST > ~/admin-test-known_hosts
ssh-keygen -lf ~/admin-test-known_hosts
```

DEPLOY_HOST使用CI实际连接的私网IPv4／DNS，端口必须一致，不能用不同公网地址替代记录。keyscan只是采集，不证明可信。

**另开云控制台可信终端：** `sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`，比较SHA256指纹，一致才信任。随后服务器 `cat ~/admin-test-known_hosts`，复制整行到Secret；非22通常主机字段为[host]:port。不使用StrictHostKeyChecking=no。

### 7.3 GitHub两个仓库分别配置

Settings → Environments → New environment命名 **test**，Deployment branches and tags只允许main；支持时设置required reviewers。以下字段放test环境：

| 类型 | 名称 | 值 |
|---|---|---|
| Variable | DEPLOY_HOST | 已核验的私网IPv4／DNS，不带协议，当前不接受IPv6 |
| Variable | DEPLOY_PORT | 实际SSH端口，如22 |
| Variable | DEPLOY_USER | admin-deploy |
| Variable | USE_TAILSCALE | 使用上述通道填小写true，否则不设／false |
| Variable | TAILSCALE_TAGS | 启用时tag:ci |
| Secret | DEPLOY_SSH_KEY | 本地 `cat ~/.ssh/admin-test-ci` 的完整私钥含首尾行 |
| Secret | DEPLOY_KNOWN_HOSTS | 核验后的完整主机公钥记录，不是指纹文字 |
| Secret | TS_OAUTH_CLIENT_ID | 启用Tailscale时的OAuth ID |
| Secret | TS_OAUTH_SECRET | 对应OAuth secret |

不填DEPLOY_DIR，路径固定。**AUTO_DEPLOY_TEST是仓库级Actions variable，不仅放Environment**，初期false。CI key无口令须安全保管并可撤销轮换；两仓使用的用户／服务器／包权限应相符。

完成后在Actions选择Backend／Frontend CI and test deployment → Run workflow → 分支main → 勾deploy。它重新检查构建main并推包，然后部署；不是任意指定历史镜像。验收status／check和业务，再按需把某仓库AUTO_DEPLOY_TEST设true开启main push自动部署；false仅阻止后续触发，不撤销正在运行的任务。

## 8. 日常发布、回滚和备份

**服务器admin-deploy：** deploy／rollback要求已有成功bootstrap。输入对应仓库成功Summary的完整digest：

```bash
read -r -p "后端完整digest: " IMAGE
python3 /opt/admin-system-test/manage.py deploy backend "$IMAGE"
# 更新前端时重新输入前端digest，并使用 deploy frontend
python3 /opt/admin-system-test/manage.py status
python3 /opt/admin-system-test/manage.py check
python3 /opt/admin-system-test/manage.py backup
```

后端先拉镜像、备份PG，再重建app和web重新解析后端IP；前端只更新web。两仓同一fcntl服务器锁，冲突直接失败，不会跨仓库排队；等前一操作完成且状态确认后再重试。不要绕过工具并发手工Compose。单实例发布可短暂中断，锁也不能保证API版本兼容。

失败可能已有迁移／容器替换，不宣称自动回滚。images.env是期望版本；status中的实际容器、last_good及历史要一起看。回退成功历史中的不同旧镜像：

```bash
python3 /opt/admin-system-test/manage.py rollback frontend
python3 /opt/admin-system-test/manage.py rollback backend --confirm-schema-compatible
python3 /opt/admin-system-test/manage.py check
```

后端参数表示你已经确认旧应用兼容当前结构，**不回退数据库**。没有合适成功历史则拒绝。不能确认就先分析迁移和备份；migration:revert可能删表，不能试着运行。

backup输出私有 `.dump` 路径；下载到受保护异地存储，并在隔离环境实际恢复验证。还需备份上传文件、加密.env、images.env与历史。没有自动定时备份或数据库恢复，不要删卷排错。

旧独立部署文件已删除：两仓docker-compose.deploy.yml、后端backup-db.sh／restore-db.sh、前端Caddyfile；两仓旧.gitlab-ci.yml已移除。备份恢复只用上文manage.py backup产物在隔离环境演练。

## 9. 查看状态与常见问题

```bash
python3 /opt/admin-system-test/manage.py status
python3 /opt/admin-system-test/manage.py check
docker logs --tail=100 admin-system-test-app-1
docker logs --tail=100 admin-system-test-web-1
docker stats --no-stream
free -h
df -h
```

日志先脱敏再分享。手工Compose默认不读images.env，即使用两份--env-file也需注意$插值差异；管理工具按字面值传入受控env，用它发布。四容器限制合计约1280MiB，不等于实际占用或2GB容量保证，系统／Docker还需内存，持续OOM须扩容。

| 现象 | 先检查 |
|---|---|
| main没deploy | 默认即如此；手动main勾deploy或仓库AUTO_DEPLOY_TEST=true |
| digest拒绝 | tag、截断、反引号、前后端仓库写反、大小写 |
| GHCR拒绝 | 同一deploy用户的登录、PAT期限/read:packages、两包Read、SSO |
| SSH超时 | 私网接入、OAuth auth_keys Write、tag／ACL、防火墙、host／port |
| publickey失败 | user、CI公私钥匹配、authorized_keys权限700／600 |
| 主机验证失败 | 核对地址／端口／重装，经云控制台重新比指纹，不关闭验证 |
| 页面502 | app迁移／健康、网络、web是否重建解析新IP |
| health绿但登录失败 | PG／Redis、seed、账号状态与密码；不只看health |
| 隧道失败 | 本地SSH窗口、18080占用、127.0.0.1地址和服务器check |
| 数据像丢了 | 项目名／DB_NAME／旧新卷，不删卷重做 |

禁止随意down -v、prune --volumes、FLUSHDB、删库恢复。公网域名／HTTPS不在默认流程；未来公开前独立审核TLS、CORS、适用备案和访问控制。

## 10. 已验证与未完成的边界

| 项目 | 本次结果 |
|---|---|
| 原生Node24检查 | 双端官方registry frozen install、类型／build通过；后端7 suites／29tests通过；eslint 0error／104既有warning |
| audit | 双端生产依赖high门槛通过，后端仍3 moderate（qs两项、js-yaml一项），前端0漏洞，不是全级别清零 |
| 静态检查 | actionlint v1.7.12通过（未运行shellcheck／pyflakes），Compose config通过 |
| 模拟工具测试 | 客户端／smoke逻辑mock后端9／前端8通过；管理工具50项中49实跑、1Windows真实flock跳过 |
| 真实本地数据库链路 | 独立PG16／Redis7临时容器＋宿主Node24编译应用：migration／health／注册／登录／用户信息通过，临时容器已清理；不是新镜像测试 |
| Docker镜像 | 双端构建在auth.docker.io匿名token请求超时，未完成镜像构建／smoke |
| GitHub／GHCR／真实服务器 | 未提交推送／PR／云端运行；账号权限、Tailscale、bootstrap、seed、发布和回滚演练由用户实际验收 |

免费额度按账户／套餐和用量变化，私有仓库共享额度、GHCR／缓存存储、Tailscale均须确认；预算提醒不一定自动停止扣费，不承诺免费，不需为了CI公开源码或购买大型Runner。

参考：[GitHub Actions费用](https://docs.github.com/en/billing/concepts/product-billing/github-actions) · [GHCR认证](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) · [Docker安装](https://docs.docker.com/engine/install/ubuntu/) · [Tailscale Action](https://github.com/tailscale/github-action/blob/v4.2.0/README.md) · [后端CI要点](../docs/ci-cd.md)。
