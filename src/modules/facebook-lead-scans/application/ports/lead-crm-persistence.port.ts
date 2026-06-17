export interface ListLeadsInput {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  platform?: string;
  excludeAnonymous?: boolean;
  leadLevel?: string;
}

export interface LeadRecord {
  id: string;
  platform: string;
  profileKey: string;
  authorName: string;
  authorUrl: string;
  contactStatus: string;
  leadLevel: string;
  leadScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadDemandRecord {
  id: string;
  leadId: string;
  platform: string;
  scanId: string | null;
  postId: string;
  postUrl: string;
  classification: string;
  leadScore: number;
  leadLevel: string;
  reasons: string[];
  evidence: any[];
  createdAt: Date;
}

export interface LeadInteractionRecord {
  id: string;
  leadId: string;
  actorId: string | null;
  actorName: string | null;
  actionType: string;
  statusFrom: string | null;
  statusTo: string | null;
  notes: string;
  createdAt: Date;
}

export interface LeadDetailsResult {
  lead: LeadRecord;
  demands: LeadDemandRecord[];
  interactions: LeadInteractionRecord[];
}

export abstract class LeadCrmPersistencePort {
  abstract listLeads(query: ListLeadsInput): Promise<{ items: LeadRecord[]; total: number }>;
  abstract getLeadDetails(id: string): Promise<LeadDetailsResult | null>;
  abstract upsertLeadFromScan(
    platform: string,
    profileKey: string,
    authorName: string,
    authorUrl: string,
    scanId: string,
    postId: string,
    postUrl: string,
    classification: string,
    leadScore: number,
    leadLevel: string,
    reasons: string[],
    evidence: any[],
  ): Promise<void>;
  abstract addInteraction(interaction: {
    leadId: string;
    actorId: string | null;
    actionType: string;
    statusFrom?: string | null;
    statusTo?: string | null;
    notes: string;
  }): Promise<void>;
}
