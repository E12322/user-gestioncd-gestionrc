import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ChambreType } from '../entities/chambre-type.enum';

export class FilterChambreDto {
  @ApiPropertyOptional({ enum: ChambreType })
  @IsOptional()
  @IsEnum(ChambreType)
  type?: ChambreType;

  @ApiPropertyOptional({ example: 'Batiment A' })
  @IsOptional()
  @IsString()
  batiment?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  disponible?: boolean;
}
