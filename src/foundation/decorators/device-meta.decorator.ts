import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface DeviceMeta {
  userAgent: string;
  platform?: string;
  ip?: string;
}

/**
 * Extracts device-related metadata from the request.
 * Usage: @DeviceMeta() device: DeviceMeta
 */
export const DeviceMetaDecorator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DeviceMeta => {
    const request = ctx.switchToHttp().getRequest();
    return {
      userAgent: request.headers?.["user-agent"] ?? "",
      platform: request.headers?.["sec-ch-ua-platform"]?.replace(/"/g, ""),
      ip: request.ip ?? request.headers?.["x-forwarded-for"],
    };
  },
);
