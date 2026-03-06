import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateBillingPolicyDto {
  @ApiProperty({ description: 'Airport ID (UUID)' })
  @IsUUID()
  airportId!: string;

  @ApiProperty({ description: 'Day of month when billing period cuts off (1-28)', minimum: 1, maximum: 28 })
  @IsInt()
  @Min(1)
  @Max(28)
  cutOffDay!: number;

  @ApiProperty({ description: 'Day of month when invoices are issued (1-28)', minimum: 1, maximum: 28 })
  @IsInt()
  @Min(1)
  @Max(28)
  issueDay!: number;

  @ApiPropertyOptional({
    description: 'Number of days from issue date to due date (1-90, default 30)',
    minimum: 1,
    maximum: 90,
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  dueDateDays?: number;

  @ApiPropertyOptional({
    description: 'Lead days before cut-off for billing preparation (0-30, default 5)',
    minimum: 0,
    maximum: 30,
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  leadDays?: number;

  @ApiPropertyOptional({
    description: 'Grace period days after due date (0-30, default 0)',
    minimum: 0,
    maximum: 30,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  gracePeriodDays?: number;

  @ApiPropertyOptional({
    description: 'Days before due date to send declaration reminder (0-30, default 3)',
    minimum: 0,
    maximum: 30,
    default: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  declarationReminderDays?: number;

  @ApiPropertyOptional({
    description: 'Fiscal year start month (1-12, default 1 = January)',
    minimum: 1,
    maximum: 12,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth?: number;

  @ApiProperty({ description: 'Policy effective from date (ISO date string)' })
  @IsDateString()
  effectiveFrom!: string;
}
