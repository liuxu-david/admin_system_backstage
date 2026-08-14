import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Project } from "./entities/project.entity";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { BusinessException } from "../../foundation/exceptions/business-exception";
import { ErrorCode } from "../../foundation/errors/error-codes";

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async create(dto: CreateProjectDto, ownerId: string): Promise<Project> {
    const project = this.projectRepository.create({ ...dto, ownerId });
    return this.projectRepository.save(project);
  }

  async findAll(ownerId?: string): Promise<Project[]> {
    const where = ownerId ? { ownerId } : {};
    return this.projectRepository.find({ where, relations: { owner: true } });
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: { owner: true },
    });
    if (!project) {
      throw new BusinessException(ErrorCode.PROJECT_NOT_FOUND);
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    Object.assign(project, dto);
    return this.projectRepository.save(project);
  }

  async remove(id: string): Promise<void> {
    const project = await this.findOne(id);
    await this.projectRepository.remove(project);
  }
}
