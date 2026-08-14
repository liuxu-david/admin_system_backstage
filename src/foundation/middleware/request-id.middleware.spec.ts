import { RequestIdMiddleware } from "./request-id.middleware";

describe("RequestIdMiddleware", () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it("should use existing x-request-id header if provided", () => {
    const req = {
      headers: { "x-request-id": "custom-id-123" },
    } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers["x-request-id"]).toBe("custom-id-123");
    expect(req.id).toBe("custom-id-123");
    expect(next).toHaveBeenCalled();
  });

  it("should generate a new requestId if not provided", () => {
    const req = {
      headers: {},
    } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers["x-request-id"]).toBeDefined();
    expect(req.id).toBeDefined();
    expect(req.headers["x-request-id"]).toBe(req.id);
    expect(typeof req.id).toBe("string");
    expect(req.id.length).toBeGreaterThan(0);
    expect(next).toHaveBeenCalled();
  });
});
