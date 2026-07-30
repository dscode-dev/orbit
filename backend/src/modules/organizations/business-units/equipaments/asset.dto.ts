import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  AssetCategory,
  AssetIdentifierType,
  AssetStatus,
} from '../../../../contracts';
import { IsUUIDv7 } from '../../../../validators';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AssetQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(180)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  customerId?: string;

  @ApiPropertyOptional({ enum: Object.values(AssetCategory) })
  @IsOptional()
  @IsIn(Object.values(AssetCategory))
  category?: AssetCategory;

  @ApiPropertyOptional({ enum: Object.values(AssetStatus) })
  @IsOptional()
  @IsIn(Object.values(AssetStatus))
  status?: AssetStatus;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class CreateAssetDto {
  @ApiProperty()
  @IsUUIDv7()
  businessUnitId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  customerId?: string;

  @ApiProperty({ enum: Object.values(AssetCategory) })
  @IsIn(Object.values(AssetCategory))
  category!: AssetCategory;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  serialNumber?: string;

  @ApiPropertyOptional({ enum: Object.values(AssetIdentifierType) })
  @IsOptional()
  @IsIn(Object.values(AssetIdentifierType))
  identifierType?: AssetIdentifierType;

  @ApiPropertyOptional({
    description: 'Payload encoded in a QR, NFC tag or internal label.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(180)
  identifier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  installationAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  warrantyUntil?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  specifications?: Record<string, unknown>;
}

export class UpdateAssetDto extends PartialType(CreateAssetDto) {
  @ApiPropertyOptional({ enum: Object.values(AssetStatus) })
  @IsOptional()
  @IsIn(Object.values(AssetStatus))
  status?: AssetStatus;
}
