import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContactRequestOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/contact-request.orm-entity';
import {
  ContactRequestListResult,
  ContactRequestPersistencePort,
  SavedContactRequest,
} from '../../application/ports/contact-request-persistence.port';
import {
  ContactRequestProps,
  ContactRequestStatus,
  ContactRequestType,
} from '../../domain/entities/contact-request';

@Injectable()
export class TypeOrmContactRequestPersistenceAdapter
  implements ContactRequestPersistencePort
{
  constructor(
    @InjectRepository(ContactRequestOrmEntity)
    private readonly repository: Repository<ContactRequestOrmEntity>,
  ) {}

  create(contactRequest: ContactRequestProps): Promise<SavedContactRequest> {
    return this.repository.save(this.repository.create(contactRequest));
  }

  async list(input: {
    page: number;
    limit: number;
    type?: ContactRequestType;
    status?: ContactRequestStatus;
  }): Promise<ContactRequestListResult> {
    const where: FindOptionsWhere<ContactRequestOrmEntity> = {};
    if (input.type) where.type = input.type;
    if (input.status) where.status = input.status;

    const [items, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    });
    return { items, total };
  }

  async updateStatus(
    id: string,
    status: ContactRequestStatus,
  ): Promise<SavedContactRequest | null> {
    const contactRequest = await this.repository.findOne({ where: { id } });
    if (!contactRequest) return null;
    contactRequest.status = status;
    return this.repository.save(contactRequest);
  }
}
