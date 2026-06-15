import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  LeaveRequestFilterDto,
  ReviewLeaveRequestDto,
  SubmitLeaveRequestDto,
} from '../../application/dtos/leave-request.dto';
import { Role } from '../../domain/value-objects/role.enum';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { LeaveRequestError } from '../../modules/leave-requests/domain/errors/leave-request.error';
import {
  CancelLeaveRequestUseCase,
  ListManagedLeaveRequestsUseCase,
  ListMyLeaveRequestsUseCase,
  ReviewLeaveRequestUseCase,
} from '../../modules/leave-requests/application/use-cases/manage-leave-request.use-cases';
import { SubmitLeaveRequestUseCase } from '../../modules/leave-requests/application/use-cases/submit-leave-request.use-case';

interface AuthenticatedRequest {
  user: {
    sub: string;
    role: Role;
  };
}

@ApiTags('Leave Requests')
@Controller('leave-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveRequestController {
  constructor(
    private readonly submitLeaveRequest: SubmitLeaveRequestUseCase,
    private readonly listMyLeaveRequests: ListMyLeaveRequestsUseCase,
    private readonly listManagedLeaveRequests: ListManagedLeaveRequestsUseCase,
    private readonly reviewLeaveRequest: ReviewLeaveRequestUseCase,
    private readonly cancelLeaveRequest: CancelLeaveRequestUseCase,
  ) {}

  @Post()
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Học sinh gửi đơn xin nghỉ học' })
  submit(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SubmitLeaveRequestDto,
  ) {
    return this.run(() =>
      this.submitLeaveRequest.execute({
        studentUserId: req.user.sub,
        classSessionId: dto.classSessionId,
        reason: dto.reason,
      }),
    );
  }

  @Get('mine')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Học sinh xem các đơn xin nghỉ của mình' })
  listMine(
    @Request() req: AuthenticatedRequest,
    @Query() filter: LeaveRequestFilterDto,
  ) {
    return this.run(() =>
      this.listMyLeaveRequests.execute({
        studentUserId: req.user.sub,
        status: filter.status,
      }),
    );
  }

  @Get()
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Giáo viên hoặc admin xem danh sách đơn xin nghỉ' })
  listManaged(
    @Request() req: AuthenticatedRequest,
    @Query() filter: LeaveRequestFilterDto,
  ) {
    return this.run(() =>
      this.listManagedLeaveRequests.execute({
        actorUserId: req.user.sub,
        actorRole: req.user.role,
        filter,
      }),
    );
  }

  @Patch(':id/review')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Duyệt hoặc từ chối đơn xin nghỉ' })
  review(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewLeaveRequestDto,
  ) {
    return this.run(() =>
      this.reviewLeaveRequest.execute({
        requestId: id,
        actorUserId: req.user.sub,
        actorRole: req.user.role,
        decision: dto.decision,
        reviewNote: dto.reviewNote,
      }),
    );
  }

  @Patch(':id/cancel')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Học sinh hủy đơn xin nghỉ đang chờ duyệt' })
  cancel(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.run(() =>
      this.cancelLeaveRequest.execute({
        requestId: id,
        studentUserId: req.user.sub,
      }),
    );
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (!(error instanceof LeaveRequestError)) throw error;
      if (
        error.code === 'STUDENT_NOT_FOUND' ||
        error.code === 'SESSION_NOT_FOUND' ||
        error.code === 'LEAVE_REQUEST_NOT_FOUND'
      ) {
        throw new NotFoundException(error.message);
      }
      if (error.code === 'FORBIDDEN' || error.code === 'NOT_ENROLLED') {
        throw new ForbiddenException(error.message);
      }
      throw new ConflictException(error.message);
    }
  }
}
