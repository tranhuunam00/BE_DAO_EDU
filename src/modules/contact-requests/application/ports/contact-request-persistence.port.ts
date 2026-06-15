import {
  ContactRequestProps,
  ContactRequestStatus,
  ContactRequestType,
} from '../../domain/entities/contact-request';

export interface SavedContactRequest extends ContactRequestProps {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactRequestListResult {
  items: SavedContactRequest[];
  total: number;
}

export abstract class ContactRequestPersistencePort {
  abstract create(
    contactRequest: ContactRequestProps,
  ): Promise<SavedContactRequest>;

  abstract list(input: {
    page: number;
    limit: number;
    type?: ContactRequestType;
    status?: ContactRequestStatus;
  }): Promise<ContactRequestListResult>;

  abstract updateStatus(
    id: string,
    status: ContactRequestStatus,
  ): Promise<SavedContactRequest | null>;
}
