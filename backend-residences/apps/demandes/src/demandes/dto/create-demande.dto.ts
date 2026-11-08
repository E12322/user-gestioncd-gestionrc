import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateDemandeDto {
  @ApiProperty({
    example: 'stu-2024-0001',
    description:
      'Identifiant de l etudiant (sera derive du JWT une fois IAuthentification branche)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  etudiantId: string;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  @IsDateString()
  dateArrivee: string;

  @ApiProperty({ example: '2027-06-30T00:00:00.000Z' })
  @IsDateString()
  dateDepart: string;

  @ApiPropertyOptional({
    example: 'c9f1b2a0-1f3e-4d5a-9b6c-7e8f9a0b1c2d',
    description: 'Chambre souhaitee (optionnel)',
  })
  @IsOptional()
  @IsUUID()
  chambreId?: string;
}
