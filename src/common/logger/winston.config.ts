import { utilities as nestWinstonModuleUtilities } from "nest-winston";
import * as winston from "winston";

export const createWinstonTransports = (env: string): winston.transport[] => {
  if (env === "prod") {
    return [
      new winston.transports.Console({
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),
    ];
  }

  // dev / test - pretty console output
  return [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike("NestApp", {
          colors: true,
          prettyPrint: true,
        }),
      ),
    }),
  ];
};
