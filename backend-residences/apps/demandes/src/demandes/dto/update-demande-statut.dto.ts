import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DemandeStatut } from '../entities/demande-statut.enum';

export class UpdateDemandeStatutDto {
  @ApiProperty({ enum: DemandeStatut, example: DemandeStatut.APPROUVEE })
  @IsEnum(DemandeStatut)
  statut: DemandeStatut;

  @ApiPropertyOptional({
    example: 'c9f1b2a0-1f3e-4d5a-9b6c-7e8f9a0b1c2d',
    description:
      'Chambre a attribuer. Requis pour une approbation si la demande n a pas de chambre souhaitee.',
  })
  @IsOptional()
  @IsUUID()
  chambreId?: string;
}
