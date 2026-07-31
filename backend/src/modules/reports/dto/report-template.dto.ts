import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class DocumentFieldDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+$/)
  @MaxLength(160)
  path!: string;
}

export class DocumentColumnDto extends DocumentFieldDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(500)
  width?: number;
}

export class ReportSectionDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]*$/)
  @MaxLength(100)
  key!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title!: string;

  @ApiProperty({
    enum: ['HEADING', 'TEXT', 'KEY_VALUE', 'TABLE', 'PAGE_BREAK'],
  })
  @IsIn(['HEADING', 'TEXT', 'KEY_VALUE', 'TABLE', 'PAGE_BREAK'])
  type!: 'HEADING' | 'TEXT' | 'KEY_VALUE' | 'TABLE' | 'PAGE_BREAK';

  @ApiProperty()
  @IsInt()
  @Min(0)
  order!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  content?: string;

  @ApiPropertyOptional({ type: [DocumentFieldDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DocumentFieldDto)
  fields?: DocumentFieldDto[];

  @ApiPropertyOptional({ type: [DocumentColumnDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => DocumentColumnDto)
  columns?: DocumentColumnDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+$/)
  @MaxLength(160)
  dataPath?: string;
}

export class SignatureSlotDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]*$/)
  @MaxLength(100)
  key!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label!: string;

  @ApiProperty({ enum: ['USER', 'CUSTOMER', 'EXTERNAL'] })
  @IsIn(['USER', 'CUSTOMER', 'EXTERNAL'])
  signerType!: 'USER' | 'CUSTOMER' | 'EXTERNAL';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  required = true;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order!: number;
}

export class DocumentSettingsDto {
  @ApiPropertyOptional({ enum: ['A4', 'LETTER'], default: 'A4' })
  @IsOptional()
  @IsIn(['A4', 'LETTER'])
  pageSize?: 'A4' | 'LETTER';

  @ApiPropertyOptional({
    enum: ['portrait', 'landscape'],
    default: 'portrait',
  })
  @IsOptional()
  @IsIn(['portrait', 'landscape'])
  orientation?: 'portrait' | 'landscape';

  @ApiPropertyOptional({ default: 48 })
  @IsOptional()
  @IsInt()
  @Min(24)
  @Max(96)
  margin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  header?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  footer?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showPageNumbers?: boolean;
}

export class CreateReportTemplateDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_-]*$/)
  @MaxLength(100)
  key!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_-]*$/)
  @MaxLength(60)
  reportKind!: string;

  @ApiProperty({ type: [ReportSectionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReportSectionDto)
  sections!: ReportSectionDto[];

  @ApiPropertyOptional({ type: [SignatureSlotDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SignatureSlotDto)
  signatureSlots?: SignatureSlotDto[];

  @ApiPropertyOptional({ type: DocumentSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentSettingsDto)
  settings?: DocumentSettingsDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateReportTemplateVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [ReportSectionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReportSectionDto)
  sections!: ReportSectionDto[];

  @ApiPropertyOptional({ type: [SignatureSlotDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SignatureSlotDto)
  signatureSlots?: SignatureSlotDto[];

  @ApiPropertyOptional({ type: DocumentSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentSettingsDto)
  settings?: DocumentSettingsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

class ReportTemplateMetadataDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateReportTemplateDto extends PartialType(
  ReportTemplateMetadataDto,
) {}

export class ReportTemplateQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  reportKind?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(180)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean;
}

export class PreviewReportTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
