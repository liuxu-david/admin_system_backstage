import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
  @ApiProperty({ description: "账号（邮箱或用户名）", example: "admin" })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: "User password",
    example: "MyP@ssw0rd",
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
