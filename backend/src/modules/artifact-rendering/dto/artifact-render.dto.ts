import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Solicitação de renderização.
 *
 * `renderStatus` **não** é entrada: o estado é do backend. O que o cliente
 * escolhe é o motor, e o registry recusa um identificador desconhecido antes
 * de qualquer trabalho ser enfileirado.
 */
export class RequestArtifactRenderDto {
  @ApiProperty({ example: 'pdf.default' })
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z][a-z0-9._-]*$/, {
    message: 'renderer must be a lowercase identifier',
  })
  renderer!: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Guardado no manifest; não altera o conteúdo do documento.',
  })
  @IsOptional()
  @IsObject()
  metadata: Record<string, unknown> = {};
}
