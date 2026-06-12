import { Injectable, NotFoundException } from '@nestjs/common';
import { Center } from '../../domain/entities/center.entity';
import { ICenterRepository } from '../../domain/repositories/center-repository.interface';

@Injectable()
export class GetCenterByIdUseCase {
  constructor(private readonly centerRepository: ICenterRepository) {}

  async execute(id: string): Promise<Center> {
    const center = await this.centerRepository.findById(id);
    if (!center) {
      throw new NotFoundException('Không tìm thấy trung tâm');
    }
    return center;
  }
}
