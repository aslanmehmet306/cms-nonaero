import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { BillingRunMode, BillingRunType } from '@shared-types/enums';

export class CreateBillingRunDto {
  @IsUUID()
  airportId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsEnum(BillingRunType)
  @IsOptional()
  runType?: BillingRunType = BillingRunType.manual;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  tenantIds?: string[];

  @IsEnum(BillingRunMode)
  @IsOptional()
  runMode?: BillingRunMode = BillingRunMode.full;

  @IsUUID()
  @IsOptional()
  previousRunId?: string;
}
