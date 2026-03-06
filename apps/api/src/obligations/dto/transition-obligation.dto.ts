import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ObligationStatus } from '@shared-types/enums';

/**
 * DTO for transitioning an obligation to a new status.
 *
 * Used by PATCH /obligations/:id/transition.
 * The service validates that the transition is allowed per the 9-state machine.
 */
export class TransitionObligationDto {
  @ApiProperty({
    enum: ObligationStatus,
    description: 'Target obligation status',
    example: ObligationStatus.pending_input,
  })
  @IsEnum(ObligationStatus)
  toStatus!: ObligationStatus;

  @ApiProperty({
    required: false,
    description: 'Reason for skipping (required when transitioning to skipped)',
    example: 'No activity this period — tenant closed for renovation',
  })
  @IsOptional()
  @IsString()
  skippedReason?: string;
}
