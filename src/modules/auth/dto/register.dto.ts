import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @ApiProperty({ description: "Email address", example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ description: "Display name", example: "John Doe", required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nickname?: string;

  @ApiProperty({
    description: "Password (min 8 chars, uppercase, lowercase, digit)",
    example: "MyP@ssw0rd",
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/, {
    message: "Password must contain uppercase, lowercase, and digit",
  })
  password!: string;
}
