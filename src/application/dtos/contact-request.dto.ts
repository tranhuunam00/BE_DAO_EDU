import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CONTACT_REQUEST_STATUSES,
  CONTACT_REQUEST_TYPES,
} from '../../modules/contact-requests/domain/entities/contact-request';
import type {
  ContactRequestStatus,
  ContactRequestType,
} from '../../modules/contact-requests/domain/entities/contact-request';

export class SubmitContactRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @Matches(/^(?:\+84|0)[\d\s.-]{9,14}$/, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phone!: string;

  @IsEnum(CONTACT_REQUEST_TYPES)
  @IsOptional()
  type?: ContactRequestType;
}

export class ListContactRequestsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @IsEnum(CONTACT_REQUEST_TYPES)
  @IsOptional()
  type?: ContactRequestType;

  @IsEnum(CONTACT_REQUEST_STATUSES)
  @IsOptional()
  status?: ContactRequestStatus;
}

export class UpdateContactRequestStatusDto {
  @IsEnum(CONTACT_REQUEST_STATUSES)
  status!: ContactRequestStatus;
}
