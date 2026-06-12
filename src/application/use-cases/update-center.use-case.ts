import { Injectable, NotFoundException } from '@nestjs/common';
import { Center } from '../../domain/entities/center.entity';
import { ICenterRepository } from '../../domain/repositories/center-repository.interface';
import { UpdateCenterDto } from '../dtos/center.dto';

@Injectable()
export class UpdateCenterUseCase {
  constructor(private readonly centerRepository: ICenterRepository) {}

  async execute(id: string, dto: UpdateCenterDto): Promise<Center> {
    const center = await this.centerRepository.findById(id);
    if (!center) {
      throw new NotFoundException('Không tìm thấy trung tâm');
    }

    if (dto.name !== undefined) center.name = dto.name;
    if (dto.phone !== undefined) center.phone = dto.phone;
    if (dto.email !== undefined) center.email = dto.email;
    if (dto.province !== undefined) center.province = dto.province;
    if (dto.districtWard !== undefined) center.districtWard = dto.districtWard;
    if (dto.primaryAddress !== undefined) center.primaryAddress = dto.primaryAddress;
    if (dto.managerName !== undefined) center.managerName = dto.managerName;
    if (dto.status !== undefined) center.status = dto.status;

    return this.centerRepository.save(center);
  }
}
