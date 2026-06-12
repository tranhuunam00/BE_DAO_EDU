import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsNotEmpty } from 'class-validator';

export class CreateCenterDto {
  @ApiProperty({ example: 'Trung tâm Đống Đa', description: 'Tên trung tâm' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ required: false, example: '02431234567', description: 'Số điện thoại' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false, example: 'dongda@dao.edu.vn', description: 'Email liên hệ' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false, example: 'Hà Nội', description: 'Tỉnh/Thành phố' })
  @IsString()
  @IsOptional()
  province?: string;

  @ApiProperty({ required: false, example: 'Đống Đa', description: 'Quận/Huyện' })
  @IsString()
  @IsOptional()
  districtWard?: string;

  @ApiProperty({ required: false, example: 'Số 1 Thái Hà', description: 'Địa chỉ chi tiết' })
  @IsString()
  @IsOptional()
  primaryAddress?: string;

  @ApiProperty({ required: false, example: 'Nguyễn Quản Lý', description: 'Tên quản lý' })
  @IsString()
  @IsOptional()
  managerName?: string;

  @ApiProperty({ example: 'Active', description: 'Trạng thái' })
  @IsString()
  @IsNotEmpty()
  status!: string;
}

export class UpdateCenterDto extends PartialType(CreateCenterDto) {}
