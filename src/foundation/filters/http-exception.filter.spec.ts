import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";
import { BusinessException } from "../exceptions/business-exception";
import { ErrorCode } from "../errors/error-codes";

function createMockHost(requestOverrides: Record<string, any> = {}): ArgumentsHost {
  const request = {
    headers: {} as Record<string, any>,
    url: "/test",
    method: "GET",
    ...requestOverrides,
  };

  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
}

describe("HttpExceptionFilter", () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it("should handle BusinessException correctly", () => {
    const exception = new BusinessException(ErrorCode.USER_NOT_FOUND);
    const host = createMockHost({ headers: { "x-request-id": "req-123" } });
    const res = host.switchToHttp().getResponse();

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.USER_NOT_FOUND,
        errorType: "BusinessException",
        message: "User not found",
        data: null,
        meta: expect.objectContaining({
          requestId: "req-123",
        }),
      }),
    );

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(typeof body.meta.timestamp).toBe("number");
    expect(body.meta.timestamp).toBeGreaterThan(1000000000000); // ms, not seconds
  });

  it("should handle validation exceptions (400) correctly", () => {
    const exception = new HttpException(
      { message: ["name should not be empty", "email must be an email"], statusCode: 400 },
      HttpStatus.BAD_REQUEST,
    );
    const host = createMockHost();
    const res = host.switchToHttp().getResponse();

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.code).toBe(ErrorCode.VALIDATION);
    expect(body.errorType).toBe("ValidationException");
    expect(body.data).toEqual(["name should not be empty", "email must be an email"]);
  });

  it("should handle generic HttpException correctly", () => {
    const exception = new HttpException("Forbidden resource", HttpStatus.FORBIDDEN);
    const host = createMockHost();
    const res = host.switchToHttp().getResponse();

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.code).toBe(ErrorCode.FORBIDDEN);
    expect(body.errorType).toBe("HttpException");
    expect(body.message).toBe("Forbidden resource");
  });

  it("should handle unknown exceptions gracefully", () => {
    const exception = new Error("Unexpected failure");
    const host = createMockHost();
    const res = host.switchToHttp().getResponse();

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(body.errorType).toBe("InternalException");
    expect(body.message).toBe("Internal server error");
  });

  it("should generate requestId if not provided", () => {
    const exception = new HttpException("test", HttpStatus.BAD_REQUEST);
    const host = createMockHost();
    const res = host.switchToHttp().getResponse();

    filter.catch(exception, host);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.meta.requestId).toBeDefined();
    expect(typeof body.meta.requestId).toBe("string");
  });
});
