import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { IsUUIDv7 } from '../../validators';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class MobileSignatureUploadDto {
  @ApiProperty({
    description: 'StorageFile AVAILABLE criado pelo fluxo seguro de upload.',
  })
  @IsUUIDv7()
  storageObjectId!: string;
}

export class MobileSignatureUploadReservationDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ enum: ['image/png', 'image/jpeg', 'image/webp'] })
  @IsIn(['image/png', 'image/jpeg', 'image/webp'])
  mimeType!: 'image/png' | 'image/jpeg' | 'image/webp';

  @ApiProperty({ maximum: 2_000_000 })
  @IsInt()
  @Min(1)
  @Max(2_000_000)
  sizeBytes!: number;
}

export class CustomerAcknowledgementInputDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  signerName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  signatureStorageFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  contactId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  expectedVersion!: string;

  @ApiProperty()
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  contentHash!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  commandId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  occurredAt?: Date;
}
