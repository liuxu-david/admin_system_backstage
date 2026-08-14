import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface JwtPayload {
  sub: string;
  email: string;
}

/**
 * Extracts the current user from the request object.
 * Usage: @CurrentUser() user: JwtPayload
 *        @CurrentUser("sub") userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user) return undefined;
    return data ? user[data as keyof JwtPayload] : user;
  },
);
