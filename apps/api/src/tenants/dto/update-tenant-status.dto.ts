import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TenantStatus } from '@shared-types/enums';

/**
 * DTO for updating a tenant's status.
 * All transitions are fully reversible: active <-> suspended <-> deactivated.
 */
export class UpdateTenantStatusDto {
  @ApiProperty({
    enum: TenantStatus,
    example: TenantStatus.suspended,
    description: 'New tenant status. All transitions are allowed (fully reversible).',
  })
  @IsEnum(TenantStatus)
  status!: TenantStatus;
}
