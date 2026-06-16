import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class FacebookLeadScanItemDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  parserVersion?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  kind!: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  groupUrl?: string;

  @IsString()
  @IsOptional()
  pageUrl?: string;

  @IsString()
  @IsOptional()
  sourceUrl?: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  parentFingerprint?: string | null;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  postId?: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  commentId?: string | null;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  parentCommentId?: string | null;

  @IsInt()
  @Min(0)
  @Max(20)
  @IsOptional()
  depth?: number;

  @IsString()
  @IsOptional()
  treePath?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  contextTexts?: string[];

  @IsString()
  @MaxLength(120)
  @IsOptional()
  replyToAuthor?: string;

  @IsString()
  @MaxLength(160)
  @IsOptional()
  authorName?: string;

  @IsString()
  @IsOptional()
  authorUrl?: string;

  @IsString()
  @IsOptional()
  text?: string;

  @IsString()
  @IsOptional()
  capturedAt?: string;

  @IsString()
  @IsOptional()
  lastSeenAt?: string;

  @IsString()
  @MaxLength(120)
  fingerprint!: string;

  @IsBoolean()
  @IsOptional()
  missingPostContent?: boolean;
}

export class SubmitFacebookLeadScanDto {
  @IsString()
  @MaxLength(80)
  @IsOptional()
  source?: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  scanSessionId?: string;

  @IsString()
  @IsOptional()
  exportedAt?: string;

  @IsObject()
  @IsOptional()
  meta?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  localAnalysis?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacebookLeadScanItemDto)
  items!: FacebookLeadScanItemDto[];
}

export class ListFacebookLeadScansDto {
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

  @IsUrl({ require_tld: false })
  @IsOptional()
  groupUrl?: string;
}
