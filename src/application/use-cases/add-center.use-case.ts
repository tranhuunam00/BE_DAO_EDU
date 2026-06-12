import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Center } from '../../domain/entities/center.entity';
import { ICenterRepository } from '../../domain/repositories/center-repository.interface';
import { CreateCenterDto } from '../dtos/center.dto';

@Injectable()
export class AddCenterUseCase {
  constructor(private readonly centerRepository: ICenterRepository) {}

  async execute(dto: CreateCenterDto): Promise<Center> {
    const centers = await this.centerRepository.findAll();
    const count = centers.length;
    const centerId = `CNT-${1001 + count}`;

    const center = new Center(
      randomUUID(),
      centerId,
      dto.name,
      dto.phone,
      dto.email,
      dto.province,
      dto.districtWard,
      dto.primaryAddress,
      dto.managerName,
      dto.status,
    );

    return this.centerRepository.save(center);
  }
}
