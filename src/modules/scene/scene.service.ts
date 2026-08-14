import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Scene } from "./entities/scene.entity";
import { CreateSceneDto } from "./dto/create-scene.dto";
import { UpdateSceneDto } from "./dto/update-scene.dto";
import { BusinessException } from "../../foundation/exceptions/business-exception";
import { ErrorCode } from "../../foundation/errors/error-codes";

@Injectable()
export class SceneService {
  constructor(
    @InjectRepository(Scene)
    private readonly sceneRepository: Repository<Scene>,
  ) {}

  async create(dto: CreateSceneDto): Promise<Scene> {
    const scene = this.sceneRepository.create(dto);
    return this.sceneRepository.save(scene);
  }

  async findAll(projectId?: string): Promise<Scene[]> {
    const where = projectId ? { projectId } : {};
    return this.sceneRepository.find({ where, relations: { project: true } });
  }

  async findOne(id: string): Promise<Scene> {
    const scene = await this.sceneRepository.findOne({
      where: { id },
      relations: { project: true },
    });
    if (!scene) {
      throw new BusinessException(ErrorCode.SCENE_NOT_FOUND);
    }
    return scene;
  }

  async update(id: string, dto: UpdateSceneDto): Promise<Scene> {
    const scene = await this.findOne(id);
    Object.assign(scene, dto);
    return this.sceneRepository.save(scene);
  }

  async remove(id: string): Promise<void> {
    const scene = await this.findOne(id);
    await this.sceneRepository.remove(scene);
  }
}
