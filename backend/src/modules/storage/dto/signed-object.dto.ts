import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Parâmetros de uma URL assinada do provider `LOCAL`.
 *
 * Validados como qualquer entrada: a assinatura prova a autorização, não a
 * boa formação. Uma chave com `..` é recusada aqui e, de novo, no provider.
 */
export class SignedObjectQueryDto {
  @IsString()
  @MaxLength(160)
  bucket!: string;

  @IsString()
  @MaxLength(1024)
  @Matches(/^[^./][^\s]*$/, { message: 'key has an invalid format' })
  key!: string;

  @IsIn(['download', 'preview', 'upload'])
  operation!: 'download' | 'preview' | 'upload';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expires!: number;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  signature!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;
}
