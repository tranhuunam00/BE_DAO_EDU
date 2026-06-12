import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsNotEmpty, IsDateString, IsEnum } from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({ example: 'Nguyễn Văn', description: 'Họ và tên đệm' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'A', description: 'Tên' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'Nam', description: 'Giới tính' })
  @IsString()
  @IsNotEmpty()
  gender!: string;

  @ApiProperty({ required: false, example: '1990-01-01', description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  birthdate?: string;

  @ApiProperty({ required: false, example: '0987654321', description: 'Số điện thoại' })
  @IsString()
  @IsOptional()
  mobile?: string;

  @ApiProperty({ required: false, example: 'nva@example.com', description: 'Email liên hệ' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false, example: '001090123456', description: 'Số CCCD' })
  @IsString()
  @IsOptional()
  citizenId?: string;

  @ApiProperty({ example: 'Teacher', description: 'Loại (Teacher hoặc TeachingAssistant)' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ required: false, example: 'Việt Nam', description: 'Quốc gia' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ required: false, example: 'Hà Nội', description: 'Tỉnh/Thành phố' })
  @IsString()
  @IsOptional()
  province?: string;

  @ApiProperty({ required: false, example: 'Cầu Giấy', description: 'Quận/Huyện' })
  @IsString()
  @IsOptional()
  districtWard?: string;

  @ApiProperty({ required: false, example: '123 Đường XYZ', description: 'Địa chỉ chi tiết' })
  @IsString()
  @IsOptional()
  primaryAddress?: string;

  @ApiProperty({ example: 'Active', description: 'Trạng thái' })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiProperty({ required: false, description: 'Ảnh đại diện (Base64)' })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty({ required: false, description: 'Email dùng để đăng nhập hệ thống' })
  @IsEmail()
  @IsOptional()
  loginEmail?: string;

  @ApiProperty({ required: false, description: 'Mật khẩu đăng nhập' })
  @IsString()
  @IsOptional()
  loginPassword?: string;
}

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {}
