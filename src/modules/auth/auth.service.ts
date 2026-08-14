import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";

import { UserService } from "../user/user.service";
import { RefreshToken } from "./entities/refresh-token.entity";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { BusinessException } from "../../foundation/exceptions/business-exception";
import { ErrorCode } from "../../foundation/errors/error-codes";
import { comparePassword } from "../../foundation/utils/hash";
import { TokenType } from "../../foundation/enums";

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.userService.create({
      email: dto.email,
      nickname: dto.nickname,
      password: dto.password,
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: { id: user.id, email: user.email, nickname: user.nickname },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new BusinessException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const isPasswordValid = await comparePassword(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new BusinessException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: { id: user.id, email: user.email, nickname: user.nickname },
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    // 仅凭 refresh token 续期：先校验其 JWT 签名拿到 userId，
    // 再查 DB 记录是否有效。不依赖 access token，access 过期也能续。
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>("jwt.refreshSecret", "default-refresh-secret"),
      });
    } catch {
      throw new BusinessException(ErrorCode.AUTH_REFRESH_TOKEN_INVALID);
    }

    const userId = payload.sub;
    const storedToken = await this.refreshTokenRepository.findOne({
      where: {
        token: refreshToken,
        userId,
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!storedToken) {
      throw new BusinessException(ErrorCode.AUTH_REFRESH_TOKEN_INVALID);
    }

    storedToken.isActive = false;
    await this.refreshTokenRepository.save(storedToken);

    const user = await this.userService.findOne(userId);
    const tokens = await this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string, refreshToken: string) {
    await this.refreshTokenRepository.update({ userId, token: refreshToken }, { isActive: false });
  }

  private parseExpiresIn(value: string): number {
    // Parse strings like "15m", "7d", "1h" to seconds
    const match = value.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900; // default 15 minutes
    const num = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return num * (multipliers[unit] || 1);
  }

  private async generateTokens(userId: string, email: string) {
    const accessExpiresIn = this.parseExpiresIn(
      this.configService.get<string>("jwt.accessExpiresIn", "15m"),
    );
    const refreshExpiresIn = this.parseExpiresIn(
      this.configService.get<string>("jwt.refreshExpiresIn", "7d"),
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, type: TokenType.ACCESS },
        {
          secret: this.configService.get<string>("jwt.accessSecret", "default-access-secret"),
          expiresIn: accessExpiresIn,
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, type: TokenType.REFRESH },
        {
          secret: this.configService.get<string>("jwt.refreshSecret", "default-refresh-secret"),
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = this.refreshTokenRepository.create({
      userId,
      token,
      expiresAt,
      isActive: true,
    });

    await this.refreshTokenRepository.save(refreshToken);
  }
}
