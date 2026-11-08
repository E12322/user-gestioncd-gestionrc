import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ChambreType } from '../entities/chambre-type.enum';

export class CreateChambreDto {
  @ApiProperty({ example: 'A-101', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  numero: string;

  @ApiProperty({ enum: ChambreType, example: ChambreType.DOUBLE })
  @IsEnum(ChambreType)
  type: ChambreType;

  @ApiProperty({ example: 2, minimum: 1, maximum: 4 })
  @IsInt()
  @Min(1)
  @Max(4)
  capacite: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  disponible?: boolean;

  @ApiProperty({ example: 'Batiment A', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  batiment: string;

  @ApiProperty({ example: 1, minimum: 0 })
  @IsInt()
  @Min(0)
  etage: number;
}
