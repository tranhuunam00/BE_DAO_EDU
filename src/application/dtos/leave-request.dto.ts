import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { LeaveRequestStatus } from '../../modules/leave-requests/domain/entities/leave-request';

export class SubmitLeaveRequestDto {
  @ApiProperty({ description: 'ID buổi học muốn xin nghỉ' })
  @IsUUID()
  classSessionId!: string;

  @ApiProperty({ description: 'Lý do xin nghỉ', minLength: 3, maxLength: 1000 })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class ReviewLeaveRequestDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsEnum(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @ApiPropertyOptional({ description: 'Ghi chú của người duyệt' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}

export class LeaveRequestFilterDto {
  @ApiPropertyOptional({
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
  })
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected', 'cancelled'])
  status?: LeaveRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classId?: string;
}
