import {
  ContactRequest,
  ContactRequestStatus,
  ContactRequestType,
} from '../../domain/entities/contact-request';
import { ContactRequestPersistencePort } from '../ports/contact-request-persistence.port';

export class SubmitContactRequestUseCase {
  constructor(private readonly persistence: ContactRequestPersistencePort) {}

  execute(input: {
    fullName: string;
    phone: string;
    type?: ContactRequestType;
  }) {
    const contactRequest = ContactRequest.create(input);
    return this.persistence.create(contactRequest.toPrimitives());
  }
}

export class ListContactRequestsUseCase {
  constructor(private readonly persistence: ContactRequestPersistencePort) {}

  execute(input: {
    page?: number;
    limit?: number;
    type?: ContactRequestType;
    status?: ContactRequestStatus;
  }) {
    return this.persistence.list({
      page: Math.max(1, input.page ?? 1),
      limit: Math.min(100, Math.max(1, input.limit ?? 20)),
      type: input.type,
      status: input.status,
    });
  }
}

export class UpdateContactRequestStatusUseCase {
  constructor(private readonly persistence: ContactRequestPersistencePort) {}

  async execute(id: string, status: ContactRequestStatus) {
    const updated = await this.persistence.updateStatus(id, status);
    if (!updated) throw new Error('CONTACT_REQUEST_NOT_FOUND');
    return updated;
  }
}
