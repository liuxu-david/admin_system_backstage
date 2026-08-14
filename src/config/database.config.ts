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
    // 开发/测试环境自动同步表结构（改实体后重启即生效，免迁移）；生产必须关闭走迁移。
    synchronize: configService.get<string>("app.env", "dev") !== "prod",
    logging: configService.get<boolean>("db.logging", false),
  }),
};
