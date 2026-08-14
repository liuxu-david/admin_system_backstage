import { HttpStatus } from "@nestjs/common";
import { BusinessException } from "./business-exception";
import { ErrorCode } from "../errors/error-codes";

describe("BusinessException", () => {
  it("should create with default message from error code", () => {
    const exception = new BusinessException(ErrorCode.USER_NOT_FOUND);

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getErrorCode()).toBe(ErrorCode.USER_NOT_FOUND);

    const response = exception.getResponse() as Record<string, any>;
    expect(response.code).toBe(ErrorCode.USER_NOT_FOUND);
    expect(response.errorType).toBe("BusinessException");
    expect(response.message).toBe("User not found");
    expect(response.data).toBeNull();
  });

  it("should create with custom message", () => {
    const exception = new BusinessException(ErrorCode.UNKNOWN, "Something went wrong");

    const response = exception.getResponse() as Record<string, any>;
    expect(response.message).toBe("Something went wrong");
    expect(exception.getErrorCode()).toBe(ErrorCode.UNKNOWN);
  });

  it("should create with custom data", () => {
    const data = { field: "email", reason: "duplicate" };
    const exception = new BusinessException(ErrorCode.USER_EMAIL_TAKEN, undefined, data);

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getErrorData()).toEqual(data);

    const response = exception.getResponse() as Record<string, any>;
    expect(response.data).toEqual(data);
  });

  it("should map error codes to correct HTTP statuses", () => {
    const cases = [
      { code: ErrorCode.UNAUTHORIZED, status: HttpStatus.UNAUTHORIZED },
      { code: ErrorCode.FORBIDDEN, status: HttpStatus.FORBIDDEN },
      { code: ErrorCode.NOT_FOUND, status: HttpStatus.NOT_FOUND },
      { code: ErrorCode.USER_EMAIL_TAKEN, status: HttpStatus.CONFLICT },
      { code: ErrorCode.INTERNAL_ERROR, status: HttpStatus.INTERNAL_SERVER_ERROR },
    ];

    for (const { code, status } of cases) {
      const exception = new BusinessException(code);
      expect(exception.getStatus()).toBe(status);
    }
  });
});
