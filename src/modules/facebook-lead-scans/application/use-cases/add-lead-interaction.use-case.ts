import { LeadCrmPersistencePort } from '../ports/lead-crm-persistence.port';

export class AddLeadInteractionUseCase {
  constructor(private readonly persistence: LeadCrmPersistencePort) {}

  async execute(input: {
    leadId: string;
    actorId: string | null;
    notes: string;
    statusTo?: string;
  }) {
    if (!input.leadId) {
      throw new Error('LEAD_ID_REQUIRED');
    }

    const details = await this.persistence.getLeadDetails(input.leadId);
    if (!details) {
      throw new Error('CRM_LEAD_NOT_FOUND');
    }

    const currentStatus = details.lead.contactStatus;
    const statusTo = input.statusTo || currentStatus;

    // Determine action type. If status changed, it's a STATUS_CHANGE. Otherwise a NOTE.
    const actionType =
      input.statusTo && input.statusTo !== currentStatus ? 'STATUS_CHANGE' : 'NOTE';

    await this.persistence.addInteraction({
      leadId: input.leadId,
      actorId: input.actorId,
      actionType,
      statusFrom: currentStatus,
      statusTo,
      notes: input.notes || '',
    });
  }
}
