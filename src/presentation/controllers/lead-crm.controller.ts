import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AddLeadInteractionDto, ListLeadsDto } from '../../application/dtos/lead-crm.dto';
import { Role } from '../../domain/value-objects/role.enum';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { ListLeadsUseCase } from '../../modules/facebook-lead-scans/application/use-cases/list-leads.use-case';
import { GetLeadDetailsUseCase } from '../../modules/facebook-lead-scans/application/use-cases/get-lead-details.use-case';
import { AddLeadInteractionUseCase } from '../../modules/facebook-lead-scans/application/use-cases/add-lead-interaction.use-case';

@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class LeadCrmController {
  constructor(
    private readonly listLeads: ListLeadsUseCase,
    private readonly getLeadDetails: GetLeadDetailsUseCase,
    private readonly addInteraction: AddLeadInteractionUseCase,
  ) {}

  @Get()
  async list(@Query() query: ListLeadsDto) {
    return this.listLeads.execute(query);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    try {
      return await this.getLeadDetails.execute(id);
    } catch (error) {
      if (error instanceof Error && error.message === 'CRM_LEAD_NOT_FOUND') {
        throw new NotFoundException('Không tìm thấy lead yêu cầu.');
      }
      throw error;
    }
  }

  @Post(':id/interactions')
  async createInteraction(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
    @Body() dto: AddLeadInteractionDto,
  ) {
    const actorId = req.user?.sub || null;
    try {
      await this.addInteraction.execute({
        leadId: id,
        actorId,
        notes: dto.notes || '',
        statusTo: dto.statusTo,
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof Error && error.message === 'CRM_LEAD_NOT_FOUND') {
        throw new NotFoundException('Không tìm thấy lead yêu cầu.');
      }
      throw error;
    }
  }
}
