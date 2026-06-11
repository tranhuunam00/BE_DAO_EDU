import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStudentDto {
  @IsString({ message: 'Tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  firstName!: string;

  @IsString({ message: 'Họ phải là chuỗi' })
  @IsNotEmpty({ message: 'Họ không được để trống' })
  lastName!: string;

  @IsString()
  @IsOptional()
  nickName?: string;

  @IsString({ message: 'Giới tính không được để trống' })
  @IsNotEmpty({ message: 'Giới tính không được để trống' })
  gender!: string;

  @IsString({ message: 'Số điện thoại không được để trống' })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  mobile!: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString({ message: 'Ngày sinh không được để trống' })
  @IsNotEmpty({ message: 'Ngày sinh không được để trống' })
  birthdate!: string;

  @IsString()
  @IsOptional()
  parentName?: string;

  @IsString()
  @IsOptional()
  relationship?: string;

  @IsString()
  @IsOptional()
  citizenId?: string;

  @IsString({ message: 'Trạng thái học tập không được để trống' })
  @IsNotEmpty({ message: 'Trạng thái học tập không được để trống' })
  status!: string;

  @IsString({ message: 'Địa chỉ không được để trống' })
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  primaryAddress!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
