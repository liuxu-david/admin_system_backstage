import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { ProjectVisibility } from "../../../foundation/enums";

export class CreateProjectDto {
  @ApiProperty({ description: "Project name", example: "My Project" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: "Project description", example: "A cool project", required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: "Project visibility",
    example: "private",
    enum: ProjectVisibility,
    required: false,
  })
  @IsEnum(ProjectVisibility)
  @IsOptional()
  visibility?: ProjectVisibility;
}
