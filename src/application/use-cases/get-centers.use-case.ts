import { Injectable } from '@nestjs/common';
import { Center } from '../../domain/entities/center.entity';
import { ICenterRepository, GetCentersQuery } from '../../domain/repositories/center-repository.interface';

@Injectable()
export class GetCentersUseCase {
  constructor(private readonly centerRepository: ICenterRepository) {}

  async execute(query: GetCentersQuery = {}): Promise<{
    centers: Center[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    
    const { centers, total } = await this.centerRepository.findPaginated({
      ...query,
      page,
      limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      centers,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
