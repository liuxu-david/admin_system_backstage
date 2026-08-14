import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ProjectService } from "./project.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { JwtAuthGuard } from "../../foundation/guards/auth.guard";
import { PermissionsGuard } from "../../foundation/guards/permissions.guard";
import { RequirePermissions } from "../../foundation/decorators/require-permissions.decorator";
import { CurrentUser, JwtPayload } from "../../foundation/decorators/current-user.decorator";

@ApiTags("Projects")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("projects")
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @RequirePermissions("project:create")
  @ApiOperation({ summary: "Create a new project" })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtPayload) {
    return this.projectService.create(dto, user.sub);
  }

  @Get()
  @RequirePermissions("project:read")
  @ApiOperation({ summary: "List all projects" })
  findAll() {
    return this.projectService.findAll();
  }

  @Get(":id")
  @RequirePermissions("project:read")
  @ApiOperation({ summary: "Get project by ID" })
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.projectService.findOne(id);
  }

  @Patch(":id")
  @RequirePermissions("project:update")
  @ApiOperation({ summary: "Update project" })
  update(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateProjectDto) {
    return this.projectService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("project:delete")
  @ApiOperation({ summary: "Delete project" })
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.projectService.remove(id);
  }
}
