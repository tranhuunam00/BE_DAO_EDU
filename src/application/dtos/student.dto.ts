import { IsNotEmpty, IsOptional, IsString, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStudentDto {
  @ApiProperty({ description: 'Tên của học sinh', example: 'Minh' })
  @IsString({ message: 'Tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  firstName!: string;

  @ApiProperty({ description: 'Họ và tên đệm của học sinh', example: 'Nguyễn Bình' })
  @IsString({ message: 'Họ phải là chuỗi' })
  @IsNotEmpty({ message: 'Họ không được để trống' })
  lastName!: string;

  @ApiPropertyOptional({ description: 'Biệt danh hoặc tên gọi ở nhà', example: 'Minh Còi' })
  @IsString()
  @IsOptional()
  nickName?: string;

  @ApiProperty({ description: 'Giới tính', example: 'Nam', enum: ['Nam', 'Nữ', 'Khác'] })
  @IsString({ message: 'Giới tính không được để trống' })
  @IsNotEmpty({ message: 'Giới tính không được để trống' })
  gender!: string;

  @ApiProperty({ description: 'Số điện thoại chính (liên hệ học sinh/phụ huynh)', example: '0987654321' })
  @IsString({ message: 'Số điện thoại không được để trống' })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  mobile!: string;

  @ApiPropertyOptional({ description: 'Địa chỉ Email của học sinh', example: 'binhminh@gmail.com' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Ngày sinh (Định dạng YYYY-MM-DD)', example: '2015-08-14' })
  @IsString({ message: 'Ngày sinh không được để trống' })
  @IsNotEmpty({ message: 'Ngày sinh không được để trống' })
  birthdate!: string;

  @ApiPropertyOptional({ description: 'Họ tên Phụ huynh / Người giám hộ 1', example: 'Nguyễn Văn Hùng' })
  @IsString()
  @IsOptional()
  parentGuardian1?: string;

  @ApiPropertyOptional({ description: 'Họ tên Phụ huynh / Người giám hộ 2', example: 'Lê Thị Lan' })
  @IsString()
  @IsOptional()
  parentGuardian2?: string;

  @ApiPropertyOptional({ description: 'Số CCCD của Phụ huynh / Người giám hộ 1', example: '046095001234' })
  @IsString()
  @IsOptional()
  parent1CitizenId?: string;

  @ApiPropertyOptional({ description: 'Số CCCD của Phụ huynh / Người giám hộ 2', example: '046095005678' })
  @IsString()
  @IsOptional()
  parent2CitizenId?: string;

  @ApiPropertyOptional({ description: 'Số CCCD / CMND của chính học sinh', example: '046096001234' })
  @IsString()
  @IsOptional()
  studentCitizenId?: string;

  @ApiPropertyOptional({ description: 'Quan hệ của Phụ huynh 1 với học sinh', example: 'Bố', enum: ['Bố', 'Mẹ', 'Anh', 'Chị', 'Ông', 'Bà', 'Người giám hộ khác'] })
  @IsString()
  @IsOptional()
  relationship1?: string;

  @ApiPropertyOptional({ description: 'Quan hệ của Phụ huynh 2 với học sinh', example: 'Mẹ' })
  @IsString()
  @IsOptional()
  relationship2?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại phụ của Phụ huynh 1', example: '0912345678' })
  @IsString()
  @IsOptional()
  otherPhone1?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại phụ của Phụ huynh 2', example: '0909999999' })
  @IsString()
  @IsOptional()
  otherPhone2?: string;

  @ApiPropertyOptional({ description: 'Mô tả / Ghi chú đặc biệt về học sinh', example: 'Học sinh hiếu động, có năng khiếu Toán' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Quốc gia thường trú', example: 'Việt Nam', default: 'Việt Nam' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Tỉnh / Thành phố thường trú', example: 'Thành phố Hải Phòng' })
  @IsString()
  @IsOptional()
  province?: string;

  @ApiPropertyOptional({ description: 'Quận / Huyện - Phường / Xã thường trú', example: 'Quận Hồng Bàng / Phường Tân Hưng' })
  @IsString()
  @IsOptional()
  districtWard?: string;

  @ApiProperty({ description: 'Địa chỉ thường trú chi tiết (Số nhà, tên đường...)', example: '123 Đường Lê Lợi' })
  @IsString({ message: 'Địa chỉ chính không được để trống' })
  @IsNotEmpty({ message: 'Địa chỉ chính không được để trống' })
  primaryAddress!: string;

  @ApiPropertyOptional({ description: 'Địa chỉ cũ trước đây (nếu có)', example: '456 Đường Trần Hưng Đạo' })
  @IsString()
  @IsOptional()
  oldAddress?: string;

  @ApiProperty({ description: 'Trạng thái học tập', example: 'Waiting for class', enum: ['Waiting for class', 'Studying', 'Suspended', 'Graduated'] })
  @IsString({ message: 'Trạng thái học tập không được để trống' })
  @IsNotEmpty({ message: 'Trạng thái học tập không được để trống' })
  status!: string;

  // Hỗ trợ tạo tài khoản đăng nhập cho học sinh
  @ApiPropertyOptional({ description: 'Email tạo tài khoản đăng nhập cho học sinh (Nút tạo tùy chọn)', example: 'stu.tu@gmail.com' })
  @IsEmail({}, { message: 'Email đăng nhập không hợp lệ' })
  @IsOptional()
  loginEmail?: string;

  @ApiPropertyOptional({ description: 'Mật khẩu tạo tài khoản đăng nhập cho học sinh', example: 'student123', default: 'student123' })
  @IsString()
  @IsOptional()
  loginPassword?: string;
}
