import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
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

const upper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const identifier = /^[a-zA-Z][a-zA-Z0-9_.-]*$/;
const typeIdentifier = /^[A-Z][A-Z0-9_.-]*$/;

export class ArtifactFieldDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(identifier)
  @MaxLength(120)
  id!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    description:
      'Metadata-driven field type. The engine does not interpret it.',
    examples: [
      'TEXT',
      'LONG_TEXT',
      'NUMBER',
      'DECIMAL',
      'DATE',
      'TIME',
      'DATETIME',
      'CHECKBOX',
      'SWITCH',
      'RADIO',
      'SELECT',
      'MULTISELECT',
      'SIGNATURE',
      'PHOTO',
      'VIDEO',
      'FILE',
      'QR_CODE',
      'BARCODE',
      'LOCATION',
      'OBSERVATION',
    ],
  })
  @Transform(upper)
  @IsString()
  @Matches(typeIdentifier)
  @MaxLength(80)
  type!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(10_000)
  order!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readOnly = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hidden = false;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  defaultValue?: unknown;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsObject({ each: true })
  validations: Record<string, unknown>[] = [];

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsObject({ each: true })
  dependencies: Record<string, unknown>[] = [];

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  conditionalExpression?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  placeholder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  mask?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  configuration: Record<string, unknown> = {};
}

export class ArtifactSectionDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(identifier)
  @MaxLength(120)
  id!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(10_000)
  order!: number;

  @ApiProperty({ description: 'Metadata-driven section type.' })
  @Transform(upper)
  @IsString()
  @Matches(typeIdentifier)
  @MaxLength(80)
  type!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required = false;

  @ApiPropertyOptional({ default: 'VISIBLE' })
  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(typeIdentifier)
  visibility = 'VISIBLE';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permissions: string[] = [];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  collapsible = false;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  configuration: Record<string, unknown> = {};

  @ApiPropertyOptional({ type: [ArtifactFieldDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => ArtifactFieldDto)
  fields: ArtifactFieldDto[] = [];
}

export class ArtifactSignatureSlotDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(identifier)
  @MaxLength(120)
  id!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  label!: string;

  @ApiProperty({ description: 'Dynamic role, e.g. OPERATOR or CUSTOMER.' })
  @Transform(upper)
  @IsString()
  @Matches(typeIdentifier)
  @MaxLength(80)
  signerRole!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(10_000)
  order!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  required = true;

  @ApiPropertyOptional({ default: 'VISIBLE' })
  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(typeIdentifier)
  visibility = 'VISIBLE';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permissions: string[] = [];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  configuration: Record<string, unknown> = {};
}

export class ArtifactLayoutDto {
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  header?: Record<string, unknown>;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  footer?: Record<string, unknown>;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  logo?: Record<string, unknown>;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  pagination?: Record<string, unknown>;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  numbering?: Record<string, unknown>;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  visualIdentity?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsObject({ each: true })
  reusableBlocks: Record<string, unknown>[] = [];
}

export class ArtifactStructureDto {
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata: Record<string, unknown> = {};

  @ApiProperty({ type: [ArtifactSectionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ArtifactSectionDto)
  sections!: ArtifactSectionDto[];

  @ApiPropertyOptional({ type: [ArtifactSignatureSlotDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ArtifactSignatureSlotDto)
  signatureSlots: ArtifactSignatureSlotDto[] = [];

  @ApiPropertyOptional({ type: ArtifactLayoutDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ArtifactLayoutDto)
  layout: ArtifactLayoutDto = new ArtifactLayoutDto();
}

export class CreateArtifactTemplateDto extends ArtifactStructureDto {
  @ApiProperty()
  @Transform(upper)
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
  @MaxLength(4000)
  description?: string;

  @ApiProperty({ description: 'Dynamic artifact classification.' })
  @Transform(upper)
  @IsString()
  @Matches(typeIdentifier)
  @MaxLength(80)
  artifactType!: string;

  @ApiPropertyOptional({ example: 'HVAC_R' })
  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(typeIdentifier)
  @MaxLength(60)
  segment?: string;

  @ApiPropertyOptional({
    enum: ['PRIVATE', 'ORGANIZATION'],
    default: 'ORGANIZATION',
  })
  @IsOptional()
  @IsIn(['PRIVATE', 'ORGANIZATION'])
  visibility: 'PRIVATE' | 'ORGANIZATION' = 'ORGANIZATION';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags: string[] = [];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder = 0;
}

class ArtifactTemplateMetadataDto {
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
  @MaxLength(4000)
  description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(typeIdentifier)
  @MaxLength(80)
  artifactType?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(typeIdentifier)
  @MaxLength(60)
  segment?: string;
  @ApiPropertyOptional({ enum: ['PRIVATE', 'ORGANIZATION'] })
  @IsOptional()
  @IsIn(['PRIVATE', 'ORGANIZATION'])
  visibility?: 'PRIVATE' | 'ORGANIZATION';
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags?: string[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder?: number;
}

export class UpdateArtifactTemplateDto extends PartialType(
  ArtifactTemplateMetadataDto,
) {}

export class CreateArtifactTemplateVersionDto extends ArtifactStructureDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeSummary?: string;
}

export class DuplicateArtifactTemplateDto {
  @ApiProperty()
  @Transform(upper)
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_-]*$/)
  @MaxLength(100)
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name?: string;
}

export class ArtifactTemplateQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(upper)
  @IsString()
  @MaxLength(80)
  artifactType?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(upper)
  @IsString()
  @MaxLength(60)
  segment?: string;
  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'INACTIVE'])
  status?: string;
  @ApiPropertyOptional({ enum: ['PRIVATE', 'ORGANIZATION', 'GLOBAL'] })
  @IsOptional()
  @IsIn(['PRIVATE', 'ORGANIZATION', 'GLOBAL'])
  visibility?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) tag?: string;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
