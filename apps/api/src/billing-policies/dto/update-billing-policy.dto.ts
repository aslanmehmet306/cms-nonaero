import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Excludes airportId — it is immutable after creation.
 * Only draft/approved policies can be updated.
 */
export class UpdateBillingPolicyDto {
  @ApiPropertyOptional({ description: 'Day of month when billing period cuts off (1-28)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  cutOffDay?: number;

  @ApiPropertyOptional({ description: 'Day of month when invoices are issued (1-28)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  issueDay?: number;

  @ApiPropertyOptional({ description: 'Days from issue date to due date (1-90)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  dueDateDays?: number;

  @ApiPropertyOptional({ description: 'Lead days before cut-off (0-30)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  leadDays?: number;

  @ApiPropertyOptional({ description: 'Grace period days (0-30)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  gracePeriodDays?: number;

  @ApiPropertyOptional({ description: 'Declaration reminder days (0-30)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  declarationReminderDays?: number;

  @ApiPropertyOptional({ description: 'Fiscal year start month (1-12)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth?: number;

  @ApiPropertyOptional({ description: 'Policy effective from date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}
