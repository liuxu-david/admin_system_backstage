import "reflect-metadata";
import * as nodeCrypto from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./foundation/filters/http-exception.filter";
import { ResponseInterceptor } from "./foundation/interceptors/response.interceptor";

// ── 兜底：TypeORM 内部用了全局 crypto.randomUUID()，
// 而 globalThis.crypto 在 Node 19+ 才默认暴露。低版本（如 18）注入 node 内置 crypto 模块。 ──
const __g = globalThis as unknown as { crypto?: { randomUUID?: unknown } };
if (typeof __g.crypto?.randomUUID !== "function") {
  __g.crypto = nodeCrypto;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const appPrefix = configService.get<string>("app.prefix", "api");
  const appPort = configService.get<number>("app.port", 3000);
  const appEnv = configService.get<string>("app.env", "dev");

  // Logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Global prefix - exclude health endpoint
  app.setGlobalPrefix(appPrefix, {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  // Global pipe - validates DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filter - unified error response
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptor - unified success response
  app.useGlobalInterceptors(new ResponseInterceptor());

  // CORS：设了 CORS_ORIGINS 就按白名单来（预发/生产必须设）；否则开发/测试放开、生产关闭
  const corsOrigins = configService.get<string[]>("app.corsOrigins", []);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : appEnv !== "prod",
    credentials: true,
  });

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle("NestJS Backend API")
    .setDescription("API documentation for the NestJS backend")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  });

  await app.listen(appPort);
  console.log(`Application running on port ${appPort}`);
  console.log(`Swagger docs: http://localhost:${appPort}/api/docs`);
  console.log(`Environment: ${appEnv}`);
}

bootstrap();
