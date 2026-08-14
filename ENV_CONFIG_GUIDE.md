# 环境变量配置说明

## 📋 概述

本项目使用 `@nestjs/config` 模块管理环境变量，通过 `cross-env` 在启动脚本中明确设置 `APP_ENV` 来加载对应环境的配置文件。

---

## 🔄 环境变量加载流程

```
步骤 1: 运行启动命令
   ↓
   pnpm start:dev
   ↓
步骤 2: cross-env 设置系统环境变量
   ↓
   APP_ENV=dev (临时设置到 process.env)
   ↓
步骤 3: NestJS 启动，ConfigModule 初始化
   ↓
   读取 process.env.APP_ENV → "dev"
   ↓
步骤 4: ConfigModule 加载对应的 .env 文件
   ↓
   加载 .env.dev 文件
   ↓
步骤 5: dotenv 将 .env.dev 中的变量注入 process.env
   ↓
   process.env.DB_HOST = "localhost"
   process.env.DB_PORT = "5432"
   process.env.JWT_ACCESS_SECRET = "..."
   ...
   ↓
步骤 6: configuration.ts 配置函数从 process.env 读取值
   ↓
   return {
     db: {
       host: process.env.DB_HOST,  // "localhost"
       port: parseInt(process.env.DB_PORT),  // 5432
       ...
     }
   }
   ↓
步骤 7: 应用代码通过 ConfigService 访问配置
   ↓
   configService.get<string>('db.host')  // "localhost"
```

---

## 📁 环境配置文件

### 文件结构

```
.env.dev       # 开发环境配置
.env.test      # 测试环境配置
.env.prod      # 生产环境配置
.env.example   # 配置模板（提交到 Git）
```

### 配置优先级

```
系统环境变量 > .env.{APP_ENV} 文件 > configuration.ts 中的默认值
```

---

## 🚀 启动命令

### 开发环境
```bash
# 启动开发服务器（自动设置 APP_ENV=dev）
pnpm start:dev

# 调试模式
pnpm start:debug
```

### 测试环境
```bash
# 运行单元测试（自动设置 APP_ENV=test）
pnpm test

# 运行 E2E 测试
pnpm test:e2e

# 启动测试服务器
cross-env APP_ENV=test pnpm start:dev
```

### 生产环境
```bash
# 构建项目
pnpm build

# 启动生产服务器（自动设置 APP_ENV=prod）
pnpm start:prod
```

### 数据库迁移
```bash
# 生成迁移（使用开发环境配置）
pnpm migration:generate

# 运行迁移
pnpm migration:run
```

---

## 🔧 配置项说明

### 应用配置 (app)

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `APP_ENV` | `dev` | 环境标识：`dev` / `test` / `prod` |
| `APP_NAME` | `nest-backend` | 应用名称 |
| `APP_PORT` | `3000` | 应用端口 |
| `APP_PREFIX` | `api` | API 路由前缀 |

### 数据库配置 (db)

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DB_HOST` | `localhost` | PostgreSQL 主机 |
| `DB_PORT` | `5432` | PostgreSQL 端口 |
| `DB_USERNAME` | `postgres` | 数据库用户名 |
| `DB_PASSWORD` | `postgres` | 数据库密码 |
| `DB_NAME` | `nest_backend` | 数据库名称 |
| `DB_LOGGING` | `false` | 是否启用 SQL 日志 |

### Redis 配置 (redis)

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `REDIS_HOST` | `localhost` | Redis 主机 |
| `REDIS_PORT` | `6379` | Redis 端口 |
| `REDIS_PASSWORD` | `undefined` | Redis 密码（可选） |
| `REDIS_DB` | `0` | Redis 数据库编号 |

### JWT 配置 (jwt)

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `JWT_ACCESS_SECRET` | `change-me...` | Access Token 密钥 |
| `JWT_REFRESH_SECRET` | `change-me...` | Refresh Token 密钥 |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access Token 过期时间 |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh Token 过期时间 |

### 邮件配置 (mail)

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MAIL_HOST` | `localhost` | SMTP 服务器 |
| `MAIL_PORT` | `587` | SMTP 端口 |
| `MAIL_USER` | `""` | SMTP 用户名 |
| `MAIL_PASS` | `""` | SMTP 密码 |
| `MAIL_FROM` | `noreply@example.com` | 发件人地址 |
| `MAIL_SECURE` | `false` | 是否使用 TLS |

### 短信配置 (sms)

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `SMS_PROVIDER` | `mock` | 短信服务商：`mock` / `aliyun` / `tencent` |
| `SMS_ACCESS_KEY_ID` | `""` | Access Key ID |
| `SMS_ACCESS_KEY_SECRET` | `""` | Access Key Secret |

### 文件存储配置 (fileStorage)

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `FILE_STORAGE_DRIVER` | `local` | 存储驱动：`local` / `s3` |
| `FILE_STORAGE_LOCAL_DIR` | `./uploads` | 本地存储目录 |
| `FILE_STORAGE_S3_BUCKET` | `""` | S3 存储桶名称 |
| `FILE_STORAGE_S3_REGION` | `""` | S3 区域 |
| `FILE_STORAGE_S3_ACCESS_KEY_ID` | `""` | S3 Access Key ID |
| `FILE_STORAGE_S3_SECRET_ACCESS_KEY` | `""` | S3 Secret Access Key |

---

## 📝 配置使用示例

### 在 Service 中使用

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  constructor(private configService: ConfigService) {}

  getDatabaseHost(): string {
    return this.configService.get<string>('db.host');
  }

  getJwtSecret(): string {
    return this.configService.get<string>('jwt.accessSecret');
  }
}
```

### 在 Module 中使用

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('db.host'),
        port: configService.get<number>('db.port'),
        // ...
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

---

## ⚠️ 注意事项

### 1. 环境变量命名规范

- 使用大写字母和下划线：`DB_HOST`、`JWT_ACCESS_SECRET`
- 使用前缀区分模块：`DB_*`、`REDIS_*`、`JWT_*`

### 2. 敏感信息

- **不要**将真实的密钥提交到 Git
- 使用 `.env.example` 作为模板
- `.env.*` 文件已添加到 `.gitignore`

### 3. 类型转换

`process.env` 中的所有值都是字符串，需要手动转换：

```typescript
// ❌ 错误
const port = process.env.DB_PORT;  // string "5432"

// ✅ 正确
const port = parseInt(process.env.DB_PORT || '5432', 10);  // number 5432
```

### 4. 默认值

在 `configuration.ts` 中为所有配置提供默认值：

```typescript
export default () => ({
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  },
});
```

---

## 🔍 调试技巧

### 查看当前配置

```typescript
// 在任意 Service 中注入 ConfigService
constructor(private configService: ConfigService) {
  console.log('Database config:', this.configService.get('db'));
  console.log('JWT config:', this.configService.get('jwt'));
}
```

### 验证环境变量加载

```typescript
// 在 main.ts 中添加
console.log('APP_ENV:', process.env.APP_ENV);
console.log('DB_HOST:', process.env.DB_HOST);
```

---

## 🐛 常见问题

### Q: 为什么修改 .env 文件后需要重启服务？

A: 环境变量在应用启动时加载一次，修改后需要重启才能生效。

### Q: 如何在不重启的情况下更新配置？

A: 可以使用 `ConfigModule` 的 `load` 功能动态加载配置，或者使用配置热更新方案。

### Q: 测试环境使用哪个配置文件？

A: 测试命令会自动设置 `APP_ENV=test`，加载 `.env.test` 文件。

### Q: 如何在 CI/CD 中配置环境变量？

A: 在 CI/CD 平台的环境变量设置中配置，或使用 `cross-env` 在脚本中设置。

---

## 📚 相关文档

- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)
- [dotenv](https://github.com/motdotla/dotenv)
- [cross-env](https://github.com/kentcdodds/cross-env)
