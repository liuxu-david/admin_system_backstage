import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of, lastValueFrom } from "rxjs";
import { ResponseInterceptor } from "./response.interceptor";

function createMockContext(requestId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: requestId ? { "x-request-id": requestId } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

function createMockCallHandler<T>(data: T): CallHandler<T> {
  return {
    handle: () => of(data),
  };
}

describe("ResponseInterceptor", () => {
  let interceptor: ResponseInterceptor<any>;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  it("should wrap response in unified format", async () => {
    const context = createMockContext("req-abc");
    const handler = createMockCallHandler({ name: "test" });

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toEqual({
      code: 0,
      data: { name: "test" },
      meta: {
        timestamp: expect.any(Number),
        requestId: "req-abc",
      },
    });
  });

  it("should use unix seconds for timestamp (not milliseconds)", async () => {
    const context = createMockContext();
    const handler = createMockCallHandler("hello");

    const beforeSec = Math.floor(Date.now() / 1000);
    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);
    const afterSec = Math.floor(Date.now() / 1000);

    expect(result.meta.timestamp).toBeGreaterThanOrEqual(beforeSec);
    expect(result.meta.timestamp).toBeLessThanOrEqual(afterSec);
    // Ensure it's seconds, not ms
    expect(result.meta.timestamp).toBeLessThan(10000000000);
  });

  it("should generate requestId if not provided in headers", async () => {
    const context = createMockContext();
    const handler = createMockCallHandler(null);

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result.meta.requestId).toBeDefined();
    expect(typeof result.meta.requestId).toBe("string");
    expect(result.meta.requestId.length).toBeGreaterThan(0);
  });

  it("should handle null data", async () => {
    const context = createMockContext("req-1");
    const handler = createMockCallHandler(null);

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result.code).toBe(0);
    expect(result.data).toBeNull();
  });

  it("should handle array data", async () => {
    const context = createMockContext("req-2");
    const handler = createMockCallHandler([1, 2, 3]);

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result.data).toEqual([1, 2, 3]);
  });
});
