import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { WinstonModule } from "nest-winston";
import { createWinstonTransports } from "./winston.config";

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const env = configService.get<string>("app.env", "dev");
        return {
          transports: createWinstonTransports(env),
          level: env === "test" ? "warn" : "debug",
        };
      },
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
