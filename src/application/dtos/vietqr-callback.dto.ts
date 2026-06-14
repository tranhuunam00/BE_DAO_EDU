import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VietQrTransactionSyncDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  bankaccount!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @IsIn(['D', 'C'])
  transType!: 'D' | 'C';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  transactionid!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  transactiontime!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  referencenumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  orderId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  terminalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subTerminalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  serviceCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  urlLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sign?: string;
}
