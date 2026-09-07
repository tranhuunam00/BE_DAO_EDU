import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  Allow,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../domain/entities/student-session-evaluation.entity';

export class EvaluationItemDto {
  @ApiProperty({ description: 'ID của học sinh' })
  @IsNotEmpty({ message: 'studentId không được để trống' })
  @IsString()
  studentId!: string;

  @ApiPropertyOptional({ enum: HomeworkStatus, default: HomeworkStatus.COMPLETED })
  @IsOptional()
  @IsEnum(HomeworkStatus)
  homeworkStatus?: HomeworkStatus;

  @ApiPropertyOptional({ enum: ParticipationStatus, default: ParticipationStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ParticipationStatus)
  participation?: ParticipationStatus;

  @ApiPropertyOptional({ enum: UnderstandingStatus, default: UnderstandingStatus.UNDERSTOOD })
  @IsOptional()
  @IsEnum(UnderstandingStatus)
  understanding?: UnderstandingStatus;

  @ApiPropertyOptional({ enum: BehaviorTag, isArray: true })
  @IsOptional()
  @IsArray()
  behaviorTags?: BehaviorTag[];

  @ApiPropertyOptional({ description: 'Điểm số lượng giá (0-10)' })
  @IsOptional()
  @IsString()
  score?: string | null;

  @ApiPropertyOptional({ description: 'Nội dung nhận xét sư phạm' })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Nhận xét không được vượt quá 2000 ký tự' })
  comment?: string | null;

  @ApiPropertyOptional({ description: 'Đánh dấu do AI sinh', default: false })
  @IsOptional()
  @IsBoolean()
  isAiGenerated?: boolean;

  @ApiPropertyOptional({ description: 'Đánh dấu giáo viên đã duyệt', default: false })
  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;

  @ApiPropertyOptional({ description: 'Tiêu chí 1-chạm' })
  @IsOptional()
  @Allow()
  criteria?: any;

  @ApiPropertyOptional({ description: 'Alias cho score' })
  @IsOptional()
  @IsString()
  evaluationScore?: string | null;

  @ApiPropertyOptional({ description: 'Alias cho comment' })
  @IsOptional()
  @IsString()
  evaluationComment?: string | null;

  @ApiPropertyOptional({ description: 'Alias cho isApproved' })
  @IsOptional()
  @IsBoolean()
  isApprovedByTeacher?: boolean;
}

export class SaveEvaluationsDto {
  @ApiProperty({ type: [EvaluationItemDto], description: 'Danh sách đánh giá từng học sinh' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluationItemDto)
  evaluations!: EvaluationItemDto[];
}
