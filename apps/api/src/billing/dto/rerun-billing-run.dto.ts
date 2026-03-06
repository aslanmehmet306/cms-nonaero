import { IsUUID } from 'class-validator';

export class RerunBillingRunDto {
  @IsUUID()
  previousRunId!: string;
}
