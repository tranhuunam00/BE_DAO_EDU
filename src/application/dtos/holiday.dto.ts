import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHolidayDto {
  @IsDateString()
  date!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateHolidayDto {
  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
