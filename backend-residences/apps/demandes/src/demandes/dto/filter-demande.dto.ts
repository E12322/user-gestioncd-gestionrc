import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DemandeStatut } from '../entities/demande-statut.enum';

export class FilterDemandeDto {
  @ApiPropertyOptional({ enum: DemandeStatut })
  @IsOptional()
  @IsEnum(DemandeStatut)
  statut?: DemandeStatut;

  @ApiPropertyOptional({ example: 'stu-2024-0001' })
  @IsOptional()
  @IsString()
  etudiantId?: string;

  @ApiPropertyOptional({ example: 'c9f1b2a0-1f3e-4d5a-9b6c-7e8f9a0b1c2d' })
  @IsOptional()
  @IsUUID()
  chambreId?: string;
}
