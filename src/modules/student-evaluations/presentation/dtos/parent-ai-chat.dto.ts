import { IsString, IsNotEmpty, IsOptional, IsArray, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParentChatMessageDto {
  @ApiProperty({ enum: ['user', 'model'] })
  @IsString()
  role!: 'user' | 'model';

  @ApiProperty()
  @IsString()
  text!: string;
}

export class AskParentAiChatDto {
  @ApiProperty({ description: 'Nội dung câu hỏi của phụ huynh', example: 'Con tôi đang yếu phần nào?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question!: string;

  @ApiPropertyOptional({ description: 'ID học sinh cần hỏi (khi phụ huynh có nhiều con)' })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({ description: 'Lịch sử hội thoại gần nhất', type: [ParentChatMessageDto] })
  @IsOptional()
  @IsArray()
  history?: ParentChatMessageDto[];
}
