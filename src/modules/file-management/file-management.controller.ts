import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { FileManagementService } from "./file-management.service";
import { CreateFileDto } from "./dto/create-file.dto";
import { JwtAuthGuard } from "../../foundation/guards/auth.guard";
import { CurrentUser, JwtPayload } from "../../foundation/decorators/current-user.decorator";

@ApiTags("File Management")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("files")
export class FileManagementController {
  constructor(private readonly fileService: FileManagementService) {}

  @Post()
  @ApiOperation({ summary: "Register a file record" })
  create(@Body() dto: CreateFileDto, @CurrentUser() user: JwtPayload) {
    return this.fileService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: "List files" })
  findAll() {
    return this.fileService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get file by ID" })
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.fileService.findOne(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete file" })
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.fileService.remove(id);
  }
}
