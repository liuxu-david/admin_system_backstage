import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { HttpExceptionFilter } from "../src/foundation/filters/http-exception.filter";
import { ResponseInterceptor } from "../src/foundation/interceptors/response.interceptor";

describe("App E2E", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Health", () => {
    it("GET /health should return ok", async () => {
      const response = await request(app.getHttpServer()).get("/health").expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.status).toBe("ok");
      expect(response.body.meta.timestamp).toBeDefined();
      expect(response.body.meta.requestId).toBeDefined();
    });
  });

  describe("Demo", () => {
    it("GET /api/demo should return demo data in unified format", async () => {
      const response = await request(app.getHttpServer()).get("/api/demo").expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.message).toBe("This is a demo endpoint");
      expect(response.body.data.data.items).toHaveLength(3);
    });
  });
});
