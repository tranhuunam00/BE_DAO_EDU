import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../domain/value-objects/role.enum';

export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(6, { message: 'Mật khẩu phải tối thiểu 6 ký tự' })
  password!: string;

  @IsString({ message: 'Tên không được để trống' })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name!: string;

  @IsEnum(Role, { message: 'Role không hợp lệ. Chỉ chấp nhận ADMIN, DOCTOR, hoặc PATIENT' })
  role!: Role;

  // Optional doctor specific fields
  @IsString()
  @IsOptional()
  specialty?: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string;

  // Optional patient specific fields
  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  medicalHistory?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password!: string;
}
