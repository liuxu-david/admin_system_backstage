import { ErrorCode, ERROR_MESSAGES, ERROR_HTTP_STATUS } from "./error-codes";
import { HttpStatus } from "@nestjs/common";

describe("ErrorCodes", () => {
  it("should have unique numeric values for all error codes", () => {
    const values = Object.values(ErrorCode).filter((v) => typeof v === "number");
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("should have messages for all error codes", () => {
    const codes = Object.values(ErrorCode).filter((v) => typeof v === "number");
    for (const code of codes) {
      expect(ERROR_MESSAGES[code]).toBeDefined();
      expect(typeof ERROR_MESSAGES[code]).toBe("string");
    }
  });

  it("should map SUCCESS to 0", () => {
    expect(ErrorCode.SUCCESS).toBe(0);
  });

  it("should have correct HTTP status for UNAUTHORIZED", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.UNAUTHORIZED]).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("should have correct HTTP status for NOT_FOUND", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.NOT_FOUND]).toBe(HttpStatus.NOT_FOUND);
  });
});
