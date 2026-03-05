import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateContractDto } from './create-contract.dto';

/**
 * UpdateContractDto: all fields optional, immutable fields (airportId, tenantId) excluded.
 * Only draft contracts can be updated — enforced in the service layer.
 */
export class UpdateContractDto extends PartialType(
  OmitType(CreateContractDto, ['airportId', 'tenantId'] as const),
) {}
