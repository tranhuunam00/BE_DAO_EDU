import {
  IsArray,
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

export class GenerateCommentDto {
  @ApiPropertyOptional({ description: 'ID của học sinh' })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiProperty({ description: 'Họ và tên học sinh' })
  @IsNotEmpty({ message: 'studentName không được để trống' })
  @IsString()
  @MaxLength(100, { message: 'Tên học sinh không được vượt quá 100 ký tự' })
  studentName!: string;

  @ApiPropertyOptional({ enum: HomeworkStatus })
  @IsOptional()
  @IsEnum(HomeworkStatus)
  homeworkStatus?: HomeworkStatus;

  @ApiPropertyOptional({ enum: ParticipationStatus })
  @IsOptional()
  @IsEnum(ParticipationStatus)
  participation?: ParticipationStatus;

  @ApiPropertyOptional({ enum: UnderstandingStatus })
  @IsOptional()
  @IsEnum(UnderstandingStatus)
  understanding?: UnderstandingStatus;

  @ApiPropertyOptional({ enum: BehaviorTag, isArray: true })
  @IsOptional()
  @IsArray()
  behaviorTags?: BehaviorTag[];

  @ApiPropertyOptional({ description: 'Điểm số nếu có' })
  @IsOptional()
  @IsString()
  score?: string | null;

  @ApiPropertyOptional({ description: 'Tên lớp học' })
  @IsOptional()
  @IsString()
  className?: string;

  @ApiPropertyOptional({ description: 'Ngày học' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Ghi chú thêm' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Tiêu chí đánh giá 1-chạm' })
  @IsOptional()
  @Allow()
  criteria?: any;
}

export class GenerateBatchCommentDto {
  @ApiPropertyOptional({ type: [GenerateCommentDto], description: 'Danh sách học sinh cần tạo nhận xét AI (tối đa 50)' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenerateCommentDto)
  items?: GenerateCommentDto[];

  @ApiPropertyOptional({ type: [GenerateCommentDto], description: 'Alias students cho items' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenerateCommentDto)
  students?: GenerateCommentDto[];
}
