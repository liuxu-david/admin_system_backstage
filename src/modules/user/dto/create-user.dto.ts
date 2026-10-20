import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty({
    description: "账号（邮箱或用户名）",
    example: "admin",
  })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: "User display name",
    example: "John Doe",
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nickname?: string;

  @ApiProperty({
    description: "Password (min 8 chars, must include uppercase, lowercase, and digit)",
    example: "MyP@ssw0rd",
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/, {
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, and one digit",
  })
  password!: string;
}
