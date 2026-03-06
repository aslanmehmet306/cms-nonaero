import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CreditNoteReason } from '@shared-types/enums';

export class UpdateCreditNoteDto {
  @ApiPropertyOptional({ enum: CreditNoteReason })
  @IsOptional()
  @IsEnum(CreditNoteReason)
  reason?: CreditNoteReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedObligationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedInvoiceLogId?: string;
}
