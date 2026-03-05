import { IsArray, IsUUID } from 'class-validator';

export class CancelTenantDto {
  @IsArray()
  @IsUUID('4', { each: true })
  tenantIds!: string[];
}
