import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AppMeta {
  requestId: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Extracts request metadata (requestId, userAgent, ip).
 * Usage: @AppMeta() meta: AppMeta
 *        @AppMeta("requestId") requestId: string
 */
export const AppMetaDecorator = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): AppMeta => {
    const request = ctx.switchToHttp().getRequest();
    const meta: AppMeta = {
      requestId: request.headers?.["x-request-id"] ?? request.id ?? "",
      userAgent: request.headers?.["user-agent"],
      ip: request.ip ?? request.headers?.["x-forwarded-for"],
    };

    return data ? { requestId: (meta as any)[data] ?? "" } : meta;
  },
);
