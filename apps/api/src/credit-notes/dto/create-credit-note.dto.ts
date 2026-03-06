import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CreditNoteReason } from '@shared-types/enums';

export class CreateCreditNoteDto {
  @ApiProperty()
  @IsUUID()
  airportId!: string;

  @ApiProperty()
  @IsUUID()
  tenantId!: string;

  @ApiProperty()
  @IsUUID()
  contractId!: string;

  @ApiProperty({ enum: CreditNoteReason })
  @IsEnum(CreditNoteReason)
  reason!: CreditNoteReason;

  @ApiProperty({ example: '5000.00' })
  @IsString()
  amount!: string;

  @ApiPropertyOptional({ default: 'TRY' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Description / justification' })
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedObligationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedInvoiceLogId?: string;
}
