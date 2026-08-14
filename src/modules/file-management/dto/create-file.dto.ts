import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { FileCategory } from "../../../foundation/enums";

export class CreateFileDto {
  @ApiProperty({ description: "Original filename", example: "photo.jpg" })
  @IsString()
  @IsNotEmpty()
  originalName!: string;

  @ApiProperty({ description: "Storage key (path in storage)", example: "uploads/2024/photo.jpg" })
  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @ApiProperty({ description: "File URL", example: "/uploads/2024/photo.jpg" })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({ description: "File size in bytes", example: 1024000 })
  @IsNumber()
  size!: number;

  @ApiProperty({ description: "MIME type", example: "image/jpeg" })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ description: "File category", enum: FileCategory, required: false })
  @IsEnum(FileCategory)
  @IsOptional()
  category?: FileCategory;
}
