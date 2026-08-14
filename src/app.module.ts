import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { configuration } from "./config";
import { databaseConfig } from "./config/database.config";

// Common modules
import { LoggerModule } from "./common/logger/logger.module";
import { RedisModule } from "./common/redis/redis.module";
import { EmailModule } from "./common/email/email.module";
import { SmsModule } from "./common/sms/sms.module";
import { FileStorageModule } from "./common/file-storage/file-storage.module";

// Feature modules
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/user.module";
import { HealthModule } from "./modules/health/health.module";
import { DemoModule } from "./modules/demo/demo.module";
import { ProjectModule } from "./modules/project/project.module";
import { SceneModule } from "./modules/scene/scene.module";
import { FileManagementModule } from "./modules/file-management/file-management.module";
import { RbacModule } from "./modules/rbac/rbac.module";

// Middleware
import { RequestIdMiddleware } from "./foundation/middleware/request-id.middleware";
import { RequestLoggerMiddleware } from "./foundation/middleware/request-logger.middleware";

@Module({
  imports: [
    // Config - loads .env.{APP_ENV} with fallback
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [`.env.${process.env.APP_ENV || "dev"}`, ".env"],
    }),

    // Database
    TypeOrmModule.forRootAsync(databaseConfig),

    // Common infrastructure
    LoggerModule,
    RedisModule,
    EmailModule,
    SmsModule,
    FileStorageModule,

    // Feature modules
    AuthModule,
    UserModule,
    HealthModule,
    DemoModule,
    ProjectModule,
    SceneModule,
    FileManagementModule,
    RbacModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, RequestLoggerMiddleware).forRoutes("*");
  }
}
