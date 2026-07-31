import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
} from 'class-validator';
import { AiExecutionStatus } from '../../contracts';
import { IsUUIDv7 } from '../../validators';

export const AiAgentStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export const AiProvider = {
  OPENAI_COMPATIBLE: 'OPENAI_COMPATIBLE',
} as const;
export const AiContextTool = {
  CUSTOMER_READ: 'customer.read',
  OPERATION_READ: 'operation.read',
  REPORT_READ: 'report.read',
} as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAiAgentDto {
  @Transform(trim)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsIn(Object.values(AiProvider))
  provider!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  model!: string;

  @IsUUIDv7()
  integrationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30_000)
  systemPrompt!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(Object.values(AiContextTool), { each: true })
  tools?: string[];

  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @IsOptional()
  @IsIn(Object.values(AiAgentStatus))
  status?: string;
}

export class UpdateAiAgentDto extends PartialType(CreateAiAgentDto) {}

export class AiAgentQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsIn(Object.values(AiAgentStatus))
  status?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ExecuteAiAgentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30_000)
  prompt!: string;

  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;

  @IsOptional()
  @IsUUIDv7()
  customerId?: string;

  @IsOptional()
  @IsUUIDv7()
  operationId?: string;

  @IsOptional()
  @IsUUIDv7()
  reportId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  idempotencyKey?: string;

  @IsOptional()
  @IsBoolean()
  notifyOnCompletion?: boolean;
}

export class AiExecutionQueryDto {
  @IsOptional()
  @IsUUIDv7()
  agentId?: string;

  @IsOptional()
  @IsUUIDv7()
  customerId?: string;

  @IsOptional()
  @IsUUIDv7()
  operationId?: string;

  @IsOptional()
  @IsUUIDv7()
  reportId?: string;

  @IsOptional()
  @IsIn(Object.values(AiExecutionStatus))
  status?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
