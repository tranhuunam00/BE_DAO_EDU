import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, IsNumber, IsBoolean, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CourseLevelDto {
  @ApiProperty({ example: 'TOÁN 6', description: 'Tên Level' })
  @IsString()
  @IsNotEmpty()
  levelName!: string;

  @ApiProperty({ example: 'TOAN6', description: 'Mã Level' })
  @IsString()
  @IsNotEmpty()
  levelCode!: string;

  @ApiProperty({ example: 200, description: 'Tổng số giờ học' })
  @IsNumber()
  totalHours!: number;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  isFixedHour?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  canUpgrade?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  gradebookSetting?: string;
}

export class CourseLevelPricingDto {
  @ApiProperty({ example: 150000, description: 'Đơn giá theo buổi cho học sinh' })
  @IsNumber()
  pricePerSession!: number;

  @ApiProperty({ example: 80000, description: 'Đơn giá theo buổi cho giáo viên' })
  @IsNumber()
  teacherWagePerSession!: number;

  @ApiProperty({ example: '2026-01-01', description: 'Ngày bắt đầu áp dụng' })
  @IsDateString()
  effectiveFrom!: string;

  @ApiProperty({ required: false, example: '2026-12-31', description: 'Ngày kết thúc áp dụng' })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}

export class CreateCourseDto {
  @ApiProperty({ example: 'ELEARNING', description: 'Loại chương trình' })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({ example: 'Học phí Lớp Củng cố kiến thức THCS', description: 'Tên chương trình' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'BUTPHA', description: 'Tên viết tắt' })
  @IsString()
  @IsNotEmpty()
  shortName!: string;

  @ApiProperty({ required: false, example: 'By hour' })
  @IsString()
  @IsOptional()
  typeOfPeriod?: string;

  @ApiProperty({ required: false, example: '2025' })
  @IsString()
  @IsOptional()
  year?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  maxSize?: number;

  @ApiProperty({ required: false, default: 'Active' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assignedTo?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  centerId?: string;

  @ApiProperty({ required: false, type: [CourseLevelDto], description: 'Danh sách Level' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseLevelDto)
  @IsOptional()
  levels?: CourseLevelDto[];
}

export class UpdateCourseDto {
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() shortName?: string;
  @IsString() @IsOptional() typeOfPeriod?: string;
  @IsString() @IsOptional() year?: string;
  @IsNumber() @IsOptional() maxSize?: number;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() assignedTo?: string;
  @IsString() @IsOptional() centerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseLevelDto)
  @IsOptional()
  levels?: CourseLevelDto[];
}

export class AddCourseLevelDto extends CourseLevelDto {
  @ApiProperty({ example: 150000, description: 'Đơn giá theo buổi cho học sinh' })
  @IsNumber()
  pricePerSession!: number;

  @ApiProperty({ example: 80000, description: 'Đơn giá theo buổi cho giáo viên' })
  @IsNumber()
  teacherWagePerSession!: number;

  @ApiProperty({ example: '2026-01-01', description: 'Ngày bắt đầu áp dụng' })
  @IsDateString()
  effectiveFrom!: string;
}

export class UpdateCourseLevelDto {
  @ApiProperty({ required: false, example: 'TOÁN 6', description: 'Tên Level' })
  @IsString()
  @IsOptional()
  levelName?: string;

  @ApiProperty({ required: false, example: 'TOAN6', description: 'Mã Level' })
  @IsString()
  @IsOptional()
  levelCode?: string;

  @ApiProperty({ required: false, example: 200, description: 'Tổng số giờ học' })
  @IsNumber()
  @IsOptional()
  totalHours?: number;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  isFixedHour?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  canUpgrade?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  gradebookSetting?: string;
}
