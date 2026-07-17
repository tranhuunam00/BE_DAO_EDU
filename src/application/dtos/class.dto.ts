import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, IsNumber, IsBoolean, IsArray, ValidateNested, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ClassScheduleDto {
  @ApiProperty({ required: false })
  @IsString() @IsOptional() roomId?: string;

  @ApiProperty({ example: 'Sat', description: 'Thứ trong tuần' })
  @IsString() @IsNotEmpty() weekday!: string;

  @ApiProperty({ example: '14:00' })
  @IsString() @IsNotEmpty() startTime!: string;

  @ApiProperty({ example: '15:30' })
  @IsString() @IsNotEmpty() endTime!: string;

  @ApiProperty({ required: false, example: 90 })
  @IsNumber() @IsOptional() durationMins?: number;
}

export class CreateClassDto {
  @ApiProperty({ description: 'ID Chương trình học' })
  @IsString() @IsNotEmpty() courseId!: string;

  @ApiProperty({ description: 'ID Level' })
  @IsString() @IsNotEmpty() courseLevelId!: string;

  @ApiProperty({ example: 'TOAN10' })
  @IsString() @IsNotEmpty() classCode!: string;

  @ApiProperty({ example: 'Toán 10 (K10) - Thầy Dũng' })
  @IsString() @IsNotEmpty() className!: string;

  @IsString() @IsOptional() upgradeFromClassId?: string;
  @IsString() @IsOptional() typeOfClass?: string;
  @IsNumber() @IsOptional() defaultHours?: number;
  @IsString() @IsOptional() status?: string;

  @ApiProperty({ description: 'Ngày khai giảng' })
  @IsDateString() @IsNotEmpty() startDate!: string;

  @ApiProperty({ description: 'Ngày kết thúc lớp học' })
  @IsDateString() @IsNotEmpty() finishDate!: string;
  @IsString() @IsOptional() syllabusBy?: string;
  @IsNumber() @IsOptional() maxSize?: number;
  @IsBoolean() @IsOptional() skipHolidays?: boolean;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() mainTeacherId?: string;
  @IsString() @IsOptional() assignedTo?: string;
  @IsString() @IsOptional() csoName?: string;
  @IsString() @IsOptional() centerId?: string;
  @IsString() @IsOptional() assistantId?: string;

  @ApiProperty({ required: false, type: [ClassScheduleDto], description: 'Lịch học cố định' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassScheduleDto)
  @IsOptional()
  schedules?: ClassScheduleDto[];
}

export class UpdateClassDto {
  @IsString() @IsOptional() courseId?: string;
  @IsString() @IsOptional() courseLevelId?: string;
  @IsString() @IsOptional() classCode?: string;
  @IsString() @IsOptional() className?: string;
  @IsString() @IsOptional() upgradeFromClassId?: string;
  @IsString() @IsOptional() typeOfClass?: string;
  @IsNumber() @IsOptional() defaultHours?: number;
  @IsString() @IsOptional() status?: string;
  @IsDateString() @IsOptional() startDate?: string;
  @IsDateString() @IsOptional() finishDate?: string;
  @IsString() @IsOptional() syllabusBy?: string;
  @IsNumber() @IsOptional() maxSize?: number;
  @IsBoolean() @IsOptional() skipHolidays?: boolean;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() mainTeacherId?: string;
  @IsString() @IsOptional() assignedTo?: string;
  @IsString() @IsOptional() csoName?: string;
  @IsString() @IsOptional() centerId?: string;
  @IsString() @IsOptional() assistantId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassScheduleDto)
  @IsOptional()
  schedules?: ClassScheduleDto[];
}

export class StudentEvaluationDto {
  @ApiProperty({ description: 'ID học sinh' })
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @ApiProperty({ required: false, description: 'Điểm đánh giá (dạng chuỗi, ví dụ: 8.25, 8.75)' })
  @IsString()
  @IsOptional()
  evaluationScore?: string | null;

  @ApiProperty({ required: false, description: 'Nhận xét' })
  @IsString()
  @IsOptional()
  evaluationComment?: string | null;
}

export class SaveEvaluationsDto {
  @ApiProperty({ type: [StudentEvaluationDto], description: 'Danh sách đánh giá học sinh' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentEvaluationDto)
  evaluations!: StudentEvaluationDto[];
}

