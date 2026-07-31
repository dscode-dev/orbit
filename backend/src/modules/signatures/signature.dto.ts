import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsUUIDv7 } from '../../validators';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSignatureDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slotKey!: string;

  @ApiProperty({ enum: ['USER', 'CUSTOMER', 'EXTERNAL'] })
  @IsIn(['USER', 'CUSTOMER', 'EXTERNAL'])
  signerType!: 'USER' | 'CUSTOMER' | 'EXTERNAL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  customerId?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  signerName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(32)
  signerDocument?: string;

  @ApiProperty({
    description:
      'Base64-encoded signature evidence (drawn signature or provider payload).',
  })
  @IsString()
  @MinLength(16)
  @MaxLength(1_500_000)
  signatureData!: string;

  @ApiProperty()
  @IsBoolean()
  consentAccepted!: boolean;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(2_000)
  consentText!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  geolocation?: Record<string, unknown>;
}

export class RevokeSignatureDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
