import { PartialType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { CreateUserDto } from "./create-user.dto";

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description: "Updated display name",
    example: "Jane Doe",
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nickname?: string;
}
