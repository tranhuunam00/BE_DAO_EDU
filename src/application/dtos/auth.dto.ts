import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../domain/value-objects/role.enum';

export class RegisterDto {
  @ApiProperty({ description: 'Địa chỉ Email dùng để đăng nhập', example: 'user.test@gmail.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;

  @ApiProperty({ description: 'Mật khẩu tài khoản (tối thiểu 6 ký tự)', example: 'password123', minLength: 6 })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(6, { message: 'Mật khẩu phải tối thiểu 6 ký tự' })
  password!: string;

  @ApiProperty({ description: 'Họ và tên hiển thị của người dùng', example: 'Nguyễn Văn Test' })
  @IsString({ message: 'Tên không được để trống' })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name!: string;

  @ApiProperty({ description: 'Vai trò phân quyền trong hệ thống', example: 'TEACHER', enum: Role })
  @IsEnum(Role, { message: 'Role không hợp lệ. Chỉ chấp nhận ADMIN, TEACHER, hoặc STUDENT' })
  role!: Role;
}

export class LoginDto {
  @ApiProperty({ description: 'Email tài khoản đăng nhập', example: 'admin@class.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;

  @ApiProperty({ description: 'Mật khẩu đăng nhập', example: 'admin123' })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh Token đã nhận được sau khi đăng nhập hoặc refresh lần trước', example: 'eyJhbGciOi...' })
  @IsString({ message: 'Refresh Token phải là chuỗi' })
  @IsNotEmpty({ message: 'Refresh Token không được để trống' })
  refreshToken!: string;
}
