import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode, ERROR_MESSAGES, ERROR_HTTP_STATUS } from "../errors/error-codes";

export class BusinessException extends HttpException {
  private readonly errorCode: ErrorCode;
  private readonly errorData: Record<string, any> | null;

  constructor(errorCode: ErrorCode, message?: string, data?: Record<string, any> | null) {
    const resolvedMessage = message ?? ERROR_MESSAGES[errorCode] ?? "Unknown error";
    const httpStatus = ERROR_HTTP_STATUS[errorCode] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    super(
      {
        code: errorCode,
        errorType: "BusinessException",
        message: resolvedMessage,
        data: data ?? null,
      },
      httpStatus,
    );

    this.errorCode = errorCode;
    this.errorData = data ?? null;
  }

  getErrorCode(): ErrorCode {
    return this.errorCode;
  }

  getErrorData(): Record<string, any> | null {
    return this.errorData;
  }
}
