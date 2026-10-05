import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

/**
 * O pedido feito em campo.
 *
 * `reason` tem mínimo de verdade — dez caracteres —, e não `@IsNotEmpty()`. "x" passa
 * em não-vazio e não diz nada ao dono, que é quem precisa decidir a partir dela.
 */
export class RequestOperationCancellationDto {
  @ApiProperty({
    example: 'Ninguém no local às 09h; portaria sem autorização.',
  })
  @IsString()
  @Length(10, 2000)
  reason!: string;

  /**
   * As fotos já enviadas contra **este** atendimento que o pedido cita.
   *
   * Opcional de propósito: chuva, pressa e bateria fazem a foto faltar com
   * frequência legítima, e exigi-la transformaria uma recusa justa em impossível de
   * registrar. O teto existe para que um aplicativo em laço não cite a galeria
   * inteira.
   */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  evidenceIds?: string[];
}

export const OPERATION_CANCELLATION_RESOLUTIONS = [
  'CANCELLED',
  'RESCHEDULED',
  'REASSIGNED',
  'DISMISSED',
] as const;

/**
 * O desfecho que o dono escolheu.
 *
 * Só o desfecho: reagendar e reatribuir **acontecem** pelas rotas de operação que já
 * existem, com o histórico e as validações delas. Aceitar aqui uma data nova ou um
 * técnico novo criaria um segundo caminho para alterar atendimento.
 */
export class ResolveOperationCancellationDto {
  @ApiProperty({ enum: OPERATION_CANCELLATION_RESOLUTIONS })
  @IsIn(OPERATION_CANCELLATION_RESOLUTIONS)
  resolution!: (typeof OPERATION_CANCELLATION_RESOLUTIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  notes?: string;
}
