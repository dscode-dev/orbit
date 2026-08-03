import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Reserva de um anexo no Storage.
 *
 * Aditivo: o registro do anexo (`POST /artifact-executions/:id/attachments`)
 * continua igual. Esta rota apenas devolve para onde enviar o binário.
 */
export class ReserveArtifactAttachmentDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  mimeType!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(5_000_000_000)
  sizeBytes!: number;
}

export class ArtifactAttachmentDownloadQueryDto {
  @ApiPropertyOptional({ enum: ['download', 'preview'], default: 'download' })
  @IsOptional()
  @IsIn(['download', 'preview'])
  operation: 'download' | 'preview' = 'download';
}
