# ───────── 构建阶段：装依赖 + 编译 ─────────
FROM node:20-alpine AS builder
WORKDIR /app

# bcrypt 原生模块在 alpine(musl) 下可能需要现场编译，装上编译工具保险
RUN apk add --no-cache python3 make g++ && corepack enable

# 先只拷依赖清单，利用 Docker 层缓存（源码改动不会重装依赖）
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ───────── 运行阶段：只带生产依赖 + 编译产物 ─────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache python3 make g++ tzdata && corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
