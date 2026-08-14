import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateSceneDto {
  @ApiProperty({ description: "Scene name", example: "Main Scene" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: "Scene description", required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: "Scene payload (JSON)", required: false })
  @IsOptional()
  payload?: Record<string, any>;

  @ApiProperty({ description: "Project ID", example: "550e8400-e29b-41d4-a716-446655440000" })
  @IsUUID()
  @IsNotEmpty()
  projectId!: string;
}
