import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModuleAsyncOptions } from "@nestjs/typeorm";

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    type: "postgres" as const,
    host: configService.get<string>("db.host", "localhost"),
    port: configService.get<number>("db.port", 5432),
    username: configService.get<string>("db.username", "postgres"),
    password: configService.get<string>("db.password", "postgres"),
    database: configService.get<string>("db.database", "nest_backend"),
    entities: [__dirname + "/../**/*.entity{.ts,.js}"],
    migrations: [__dirname + "/../database/migrations/*{.ts,.js}"],
    // 仅本地 dev 自动同步表结构（改实体重启即生效）。
    // 测试/预发/生产一律走 migration（容器启动时由 entrypoint 自动执行 migration:run），
    // 共用环境如果开着 synchronize，实体一改表就会被 CI 部署悄悄改掉，非常危险。
    synchronize: configService.get<string>("app.env", "dev") === "dev",
    logging: configService.get<boolean>("db.logging", false),
  }),
};
