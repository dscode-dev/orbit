import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IntegrationCategory, IntegrationProvider } from '../../../contracts';

export class CreateIntegrationDto {
  @ApiProperty({ enum: Object.values(IntegrationProvider) })
  @IsIn(Object.values(IntegrationProvider))
  provider!: IntegrationProvider;

  @ApiProperty({ enum: Object.values(IntegrationCategory) })
  @IsIn(Object.values(IntegrationCategory))
  category!: IntegrationCategory;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Provider credentials. Accepted only on writes and never returned.',
  })
  @IsOptional()
  @IsObject()
  secrets?: Record<string, unknown>;
}

export class UpdateIntegrationDto extends PartialType(CreateIntegrationDto) {
  @ApiPropertyOptional({
    description: 'Permanently remove stored credentials.',
  })
  @IsOptional()
  @IsBoolean()
  clearSecrets?: boolean;
}
