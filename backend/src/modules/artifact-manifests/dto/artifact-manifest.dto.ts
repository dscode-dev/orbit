import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
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
} from 'class-validator';
import { ARTIFACT_MANIFEST_FORMATS } from '../artifact-manifest.read-models';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const upper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/**
 * Abertura de revisão.
 *
 * `renderer` identifica quem vai produzir o conteúdo. Enquanto o Rendering
 * Engine não existe, quem abre revisão informa o identificador do processo que
 * entregará o arquivo — o campo já é o ponto de ligação previsto para ele.
 */
export class OpenArtifactManifestRevisionDto {
  @ApiProperty({ example: 'pdf.default' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[a-z][a-z0-9._-]*$/, {
    message: 'renderer must be a lowercase identifier',
  })
  renderer!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  rendererVersion?: string;

  @ApiPropertyOptional({ enum: ARTIFACT_MANIFEST_FORMATS, default: 'PDF' })
  @IsOptional()
  @Transform(upper)
  @IsIn(ARTIFACT_MANIFEST_FORMATS)
  format: string = 'PDF';

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata: Record<string, unknown> = {};
}

/**
 * Reserva do arquivo da revisão.
 *
 * Devolve uma URL de upload. O conteúdo vai direto para o storage; a API não
 * recebe o binário. `sha256` **não** é aceito do cliente: o hash oficial é
 * calculado sobre o que foi realmente gravado.
 */
export class ReserveArtifactManifestFileDto {
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

  @ApiProperty({ description: 'Tamanho declarado, conferido na confirmação.' })
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  sizeBytes!: number;
}

/** Confirmação do upload: o servidor lê o objeto e calcula o hash. */
export class ConfirmArtifactManifestFileDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  @Matches(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  )
  fileId!: string;
}

export class RevokeArtifactManifestDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ArtifactManifestDownloadQueryDto {
  @ApiPropertyOptional({ enum: ['download', 'preview'], default: 'download' })
  @IsOptional()
  @IsIn(['download', 'preview'])
  operation: 'download' | 'preview' = 'download';
}
