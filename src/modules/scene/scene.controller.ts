import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { SceneService } from "./scene.service";
import { CreateSceneDto } from "./dto/create-scene.dto";
import { UpdateSceneDto } from "./dto/update-scene.dto";
import { JwtAuthGuard } from "../../foundation/guards/auth.guard";

@ApiTags("Scenes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("scenes")
export class SceneController {
  constructor(private readonly sceneService: SceneService) {}

  @Post()
  @ApiOperation({ summary: "Create a new scene" })
  create(@Body() dto: CreateSceneDto) {
    return this.sceneService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List scenes, optionally filtered by project" })
  findAll(@Query("projectId") projectId?: string) {
    return this.sceneService.findAll(projectId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get scene by ID" })
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.sceneService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update scene" })
  update(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateSceneDto) {
    return this.sceneService.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete scene" })
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.sceneService.remove(id);
  }
}
