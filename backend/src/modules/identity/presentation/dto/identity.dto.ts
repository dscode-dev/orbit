import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BusinessUnitType } from '../../../../contracts';
import { IsDocument, IsUUIDv7 } from '../../../../validators';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @ApiProperty()
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(6, 10)
  mfaCode?: string;

  @ApiPropertyOptional({ default: 'WEB' })
  @IsOptional()
  @IsIn(['WEB', 'MOBILE', 'API'])
  client = 'WEB';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceId?: string;
}

export class RegisterOrganizationDto {
  @ApiProperty()
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  organizationName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  legalName!: string;

  @ApiProperty()
  @IsIn(['CPF', 'CNPJ'])
  documentType!: string;

  @ApiProperty()
  @IsDocument()
  @IsString()
  @MinLength(11)
  @MaxLength(18)
  documentNumber!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  city!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  street!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 2)
  stateCode!: string;

  @ApiPropertyOptional({ default: 'SERVICES' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  primarySegment = 'SERVICES';

  @ApiPropertyOptional({ default: 'STARTER' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  planKey = 'STARTER';

  @ApiPropertyOptional({ default: BusinessUnitType.HEADQUARTERS })
  @IsOptional()
  @IsIn(Object.values(BusinessUnitType))
  businessUnitType: BusinessUnitType = BusinessUnitType.HEADQUARTERS;

  @ApiPropertyOptional({ default: 'WEB' })
  @IsOptional()
  @IsIn(['WEB', 'MOBILE', 'API'])
  client = 'WEB';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceId?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}

export class LogoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class CreateInvitationDto {
  @ApiProperty()
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsUUIDv7()
  roleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;
}

export class AcceptInvitationDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class VerifyMfaDto {
  @ApiProperty()
  @IsString()
  @Length(6, 10)
  code!: string;
}

export class EnableMfaDto extends VerifyMfaDto {
  @ApiProperty()
  @IsUUIDv7()
  factorId!: string;
}
