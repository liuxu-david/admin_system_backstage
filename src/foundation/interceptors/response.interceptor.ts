import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, map } from "rxjs";
import { randomUUID } from "crypto";
import { Request } from "express";

export interface UnifiedResponse<T> {
  code: 0;
  data: T;
  meta: {
    timestamp: number;
    requestId: string;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, UnifiedResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<UnifiedResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();

    return next.handle().pipe(
      map((data) => {
        const requestId = request.headers?.["x-request-id"] ?? (request as any).id ?? randomUUID();

        return {
          code: 0 as const,
          data,
          meta: {
            timestamp: Math.floor(Date.now() / 1000), // Unix seconds - intentional divergence from filter
            requestId,
          },
        };
      }),
    );
  }
}
