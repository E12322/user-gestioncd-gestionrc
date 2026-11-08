import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ContratStatut } from '../entities/contrat-statut.enum';

export class FindResidentContratsDto {
  @ApiPropertyOptional({ enum: ContratStatut })
  @IsOptional()
  @IsEnum(ContratStatut)
  statut?: ContratStatut;
}
