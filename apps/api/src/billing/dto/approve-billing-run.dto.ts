import { IsUUID } from 'class-validator';

export class ApproveBillingRunDto {
  @IsUUID()
  approvedBy!: string;
}
