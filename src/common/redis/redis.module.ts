import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export const REDIS_CLIENT = "REDIS_CLIENT";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>("redis.host", "localhost");
        const port = configService.get<number>("redis.port", 6379);
        const password = configService.get<string>("redis.password");
        const db = configService.get<number>("redis.db", 0);

        return new Redis({
          host,
          port,
          password: password || undefined,
          db,
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            if (times > 10) return null;
            return Math.min(times * 200, 3000);
          },
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
