import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsString, IsUUID } from 'class-validator';
import { FormulaType } from '@shared-types/enums';

export class CreateFormulaDto {
  @ApiProperty({ description: 'Airport ID (UUID)' })
  @IsUUID()
  airportId!: string;

  @ApiProperty({ description: 'Unique formula code (e.g. RENT-FIXED)' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Human-readable formula name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: FormulaType, description: 'Formula type' })
  @IsEnum(FormulaType)
  formulaType!: FormulaType;

  @ApiProperty({ description: 'Math.js expression (e.g. area_m2 * rate_per_m2)' })
  @IsString()
  @IsNotEmpty()
  expression!: string;

  @ApiProperty({
    description: 'Variable definitions — free-form JSON with variable hints',
    example: { area_m2: 'Area in square meters', rate_per_m2: 'Monthly rate per m2' },
  })
  @IsObject()
  variables!: Record<string, unknown>;
}
