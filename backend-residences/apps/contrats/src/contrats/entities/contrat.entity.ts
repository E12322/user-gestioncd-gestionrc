import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { NumericTransformer } from '../../common/transformers/numeric.transformer';
import { ContratStatut } from './contrat-statut.enum';

@Entity('contrats')
@Unique('UQ_contrat_demande', ['demandeId'])
export class Contrat {
  @ApiProperty({ example: 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'stu-2024-0001' })
  @Index()
  @Column({ type: 'varchar', length: 100 })
  residentId: string;

  @ApiProperty({ example: 'c9f1b2a0-1f3e-4d5a-9b6c-7e8f9a0b1c2d' })
  @Index()
  @Column({ type: 'uuid' })
  chambreId: string;

  @ApiProperty({ example: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a' })
  @Index()
  @Column({ type: 'uuid' })
  demandeId: string;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  @Column({ type: 'timestamptz' })
  dateDebut: Date;

  @ApiProperty({ example: '2027-06-30T00:00:00.000Z' })
  @Column({ type: 'timestamptz' })
  dateFin: Date;

  @ApiProperty({ example: 100, description: 'Montant mensuel en TND' })
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: new NumericTransformer(),
  })
  montantMensuel: number;

  @ApiProperty({ enum: ContratStatut, example: ContratStatut.ACTIF })
  @Index()
  @Column({ type: 'enum', enum: ContratStatut, default: ContratStatut.ACTIF })
  statut: ContratStatut;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
