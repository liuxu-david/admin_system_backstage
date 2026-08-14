import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { ErrorCode, ERROR_MESSAGES } from "../errors/error-codes";
import { BusinessException } from "../exceptions/business-exception";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers["x-request-id"] as string) ?? (request as any).id ?? randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: number = ErrorCode.UNKNOWN;
    let errorType = "UnknownException";
    let message = ERROR_MESSAGES[ErrorCode.UNKNOWN];
    let data: any = null;

    if (exception instanceof BusinessException) {
      status = exception.getStatus();
      const body = exception.getResponse() as Record<string, any>;
      code = body.code ?? exception.getErrorCode();
      errorType = "BusinessException";
      message = body.message ?? exception.message;
      data = body.data ?? null;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as Record<string, any>;

      if (status === HttpStatus.BAD_REQUEST) {
        errorType = "ValidationException";
        code = ErrorCode.VALIDATION;
        message = ERROR_MESSAGES[ErrorCode.VALIDATION];
        data = Array.isArray(body.message) ? body.message : [body.message];
      } else {
        errorType = "HttpException";
        code = this.mapHttpStatusToCode(status);
        message = typeof body.message === "string" ? body.message : exception.message;
        data = null;
      }
    } else {
      this.logger.error(
        `Unhandled exception: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
      code = ErrorCode.INTERNAL_ERROR;
      errorType = "InternalException";
      message = ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR];
      data = null;
    }

    const body = {
      code,
      errorType,
      message,
      data,
      meta: {
        timestamp: Date.now(), // milliseconds, intentionally different from success interceptor
        requestId,
        path: request.url,
      },
    };

    this.logger.warn(`${request.method} ${request.url} -> ${status} [${errorType}] ${message}`);

    response.status(status).json(body);
  }

  private mapHttpStatusToCode(status: number): number {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION;
      default:
        return ErrorCode.UNKNOWN;
    }
  }
}
