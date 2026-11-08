import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ContratStatut } from '../entities/contrat-statut.enum';

export class FilterContratDto {
  @ApiPropertyOptional({ enum: ContratStatut })
  @IsOptional()
  @IsEnum(ContratStatut)
  statut?: ContratStatut;

  @ApiPropertyOptional({ example: 'stu-2024-0001' })
  @IsOptional()
  @IsString()
  residentId?: string;

  @ApiPropertyOptional({ example: 'c9f1b2a0-1f3e-4d5a-9b6c-7e8f9a0b1c2d' })
  @IsOptional()
  @IsUUID()
  chambreId?: string;

  @ApiPropertyOptional({ example: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a' })
  @IsOptional()
  @IsUUID()
  demandeId?: string;
}
