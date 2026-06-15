import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ListContactRequestsDto,
  SubmitContactRequestDto,
  UpdateContactRequestStatusDto,
} from '../../application/dtos/contact-request.dto';
import { Role } from '../../domain/value-objects/role.enum';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import {
  ListContactRequestsUseCase,
  SubmitContactRequestUseCase,
  UpdateContactRequestStatusUseCase,
} from '../../modules/contact-requests/application/use-cases/manage-contact-requests.use-cases';

@Controller('contact-requests')
export class ContactRequestController {
  constructor(
    private readonly submitContactRequest: SubmitContactRequestUseCase,
    private readonly listContactRequests: ListContactRequestsUseCase,
    private readonly updateContactRequestStatus: UpdateContactRequestStatusUseCase,
  ) {}

  @Post()
  async submit(@Body() dto: SubmitContactRequestDto) {
    try {
      const contactRequest = await this.submitContactRequest.execute(dto);
      return {
        id: contactRequest.id,
        message: 'Đã gửi thông tin liên hệ thành công.',
      };
    } catch (error) {
      if (
        error instanceof Error &&
        ['CONTACT_REQUEST_INVALID_NAME', 'CONTACT_REQUEST_INVALID_PHONE'].includes(
          error.message,
        )
      ) {
        throw new BadRequestException('Thông tin liên hệ không hợp lệ.');
      }
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  list(@Query() query: ListContactRequestsDto) {
    return this.listContactRequests.execute(query);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContactRequestStatusDto,
  ) {
    try {
      return await this.updateContactRequestStatus.execute(id, dto.status);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'CONTACT_REQUEST_NOT_FOUND'
      ) {
        throw new NotFoundException('Không tìm thấy yêu cầu liên hệ.');
      }
      throw error;
    }
  }
}
