import { LeadCrmPersistencePort } from '../ports/lead-crm-persistence.port';

export class GetLeadDetailsUseCase {
  constructor(private readonly persistence: LeadCrmPersistencePort) {}

  async execute(id: string) {
    const details = await this.persistence.getLeadDetails(id);
    if (!details) {
      throw new Error('CRM_LEAD_NOT_FOUND');
    }
    return details;
  }
}
