import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAssignmentDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  description?: string;

  @IsDateString()
  @IsOptional()
  dueAt?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  maxScore?: number;

  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';
}

export class UpdateAssignmentDto {
  @IsString()
  @MaxLength(255)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(10000)
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  dueAt?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  maxScore?: number;

  @IsIn(['draft', 'published', 'closed'])
  @IsOptional()
  status?: 'draft' | 'published' | 'closed';
}

export class SubmitAssignmentDto {
  @IsString()
  @MaxLength(20000)
  @IsOptional()
  answerText?: string;
}

export class GradeSubmissionDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score!: number;

  @IsString()
  @MaxLength(10000)
  @IsOptional()
  feedback?: string;
}
