import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

import { BusinessException } from "../exceptions/business-exception";
import { ErrorCode } from "../errors/error-codes";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw new BusinessException(
        ErrorCode.AUTH_TOKEN_INVALID,
        err?.message ?? "Invalid or missing access token",
      );
    }
    return user;
  }
}
