import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/lead.orm-entity';
import { LeadDemandOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/lead-demand.orm-entity';
import { LeadInteractionOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/lead-interaction.orm-entity';
import {
  LeadCrmPersistencePort,
  LeadDetailsResult,
  LeadRecord,
  ListLeadsInput,
} from '../../application/ports/lead-crm-persistence.port';

@Injectable()
export class TypeOrmLeadCrmPersistenceAdapter implements LeadCrmPersistencePort {
  constructor(
    @InjectRepository(LeadOrmEntity)
    private readonly leadRepository: Repository<LeadOrmEntity>,
    @InjectRepository(LeadDemandOrmEntity)
    private readonly demandRepository: Repository<LeadDemandOrmEntity>,
    @InjectRepository(LeadInteractionOrmEntity)
    private readonly interactionRepository: Repository<LeadInteractionOrmEntity>,
  ) {}

  async listLeads(query: ListLeadsInput): Promise<{ items: LeadRecord[]; total: number }> {
    const qb = this.leadRepository.createQueryBuilder('lead');

    if (query.platform) {
      qb.andWhere('lead.platform = :platform', { platform: query.platform });
    }

    if (query.status) {
      qb.andWhere('lead.contactStatus = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(lead.authorName ILIKE :search OR lead.authorUrl ILIKE :search OR lead.profileKey ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Left join demands to fetch score and level information
    qb.leftJoinAndSelect('lead.demands', 'demand');
    
    qb.orderBy('lead.createdAt', 'DESC');
    qb.addOrderBy('demand.createdAt', 'DESC');

    qb.skip((query.page - 1) * query.limit);
    qb.take(query.limit);

    const [paginatedLeads, paginatedTotal] = await qb.getManyAndCount();

    return {
      items: paginatedLeads.map((l) => this.toLeadRecord(l)),
      total: paginatedTotal,
    };
  }

  async getLeadDetails(id: string): Promise<LeadDetailsResult | null> {
    const lead = await this.leadRepository.findOne({ where: { id } });
    if (!lead) return null;

    const demands = await this.demandRepository.find({
      where: { leadId: id },
      order: { createdAt: 'DESC' },
    });

    const interactions = await this.interactionRepository
      .createQueryBuilder('interaction')
      .leftJoinAndSelect('interaction.actor', 'actor')
      .where('interaction.leadId = :id', { id })
      .orderBy('interaction.createdAt', 'DESC')
      .getMany();

    return {
      lead: this.toLeadRecord(lead),
      demands: demands.map((d) => ({
        id: d.id,
        leadId: d.leadId,
        platform: d.platform,
        scanId: d.scanId,
        postId: d.postId,
        postUrl: d.postUrl,
        classification: d.classification,
        leadScore: d.leadScore,
        leadLevel: d.leadLevel,
        reasons: d.reasons,
        evidence: d.evidence,
        createdAt: d.createdAt,
      })),
      interactions: interactions.map((i) => ({
        id: i.id,
        leadId: i.leadId,
        actorId: i.actorId,
        actorName: i.actor ? i.actor.name : null,
        actionType: i.actionType,
        statusFrom: i.statusFrom,
        statusTo: i.statusTo,
        notes: i.notes,
        createdAt: i.createdAt,
      })),
    };
  }

  async upsertLeadFromScan(
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
  ): Promise<void> {
    await this.leadRepository.manager.transaction(async (manager) => {
      let lead = await manager.findOne(LeadOrmEntity, {
        where: { platform, profileKey },
      });

      if (!lead) {
        lead = manager.create(LeadOrmEntity, {
          platform,
          profileKey,
          authorName,
          authorUrl,
          contactStatus: 'NEW',
        });
      } else {
        lead.authorName = authorName;
        lead.authorUrl = authorUrl;
        // If the lead was previously marked as LOST, reset them to NEW because there is a new scan inquiry
        if (lead.contactStatus === 'LOST') {
          lead.contactStatus = 'NEW';
        }
      }

      lead = await manager.save(lead);

      // Create a new demand record
      const demand = manager.create(LeadDemandOrmEntity, {
        leadId: lead.id,
        platform,
        scanId,
        postId,
        postUrl,
        classification,
        leadScore,
        leadLevel,
        reasons,
        evidence,
      });

      await manager.save(demand);
    });
  }

  async addInteraction(interaction: {
    leadId: string;
    actorId: string | null;
    actionType: string;
    statusFrom?: string | null;
    statusTo?: string | null;
    notes: string;
  }): Promise<void> {
    await this.leadRepository.manager.transaction(async (manager) => {
      const lead = await manager.findOne(LeadOrmEntity, {
        where: { id: interaction.leadId },
      });

      if (!lead) {
        throw new Error('CRM_LEAD_NOT_FOUND');
      }

      const statusFrom = interaction.statusFrom || lead.contactStatus;
      const statusTo = interaction.statusTo || statusFrom;

      const record = manager.create(LeadInteractionOrmEntity, {
        leadId: interaction.leadId,
        actorId: interaction.actorId,
        actionType: interaction.actionType,
        statusFrom,
        statusTo,
        notes: interaction.notes,
      });

      await manager.save(record);

      if (lead.contactStatus !== statusTo) {
        lead.contactStatus = statusTo;
        await manager.save(lead);
      }
    });
  }

  private toLeadRecord(entity: LeadOrmEntity): LeadRecord {
    return {
      id: entity.id,
      platform: entity.platform,
      profileKey: entity.profileKey,
      authorName: entity.authorName,
      authorUrl: entity.authorUrl,
      contactStatus: entity.contactStatus,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      // Pass raw related entity arrays if they were fetched
      demands: entity.demands,
    } as unknown as LeadRecord;
  }
}
