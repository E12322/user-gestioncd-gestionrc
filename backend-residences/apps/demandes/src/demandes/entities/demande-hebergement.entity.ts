import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DemandeStatut } from './demande-statut.enum';

@Entity('demandes_hebergement')
export class DemandeHebergement {
  @ApiProperty({ example: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'stu-2024-0001' })
  @Index()
  @Column({ type: 'varchar', length: 100 })
  etudiantId: string;

  @ApiProperty({ enum: DemandeStatut, example: DemandeStatut.EN_ATTENTE })
  @Index()
  @Column({
    type: 'enum',
    enum: DemandeStatut,
    default: DemandeStatut.EN_ATTENTE,
  })
  statut: DemandeStatut;

  @ApiProperty({ example: '2026-10-19T10:00:00.000Z' })
  @CreateDateColumn({ type: 'timestamptz' })
  dateDepot: Date;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  @Column({ type: 'timestamptz' })
  dateArrivee: Date;

  @ApiProperty({ example: '2027-06-30T00:00:00.000Z' })
  @Column({ type: 'timestamptz' })
  dateDepart: Date;

  @ApiPropertyOptional({ example: 'c9f1b2a0-1f3e-4d5a-9b6c-7e8f9a0b1c2d' })
  @Index()
  @Column({ type: 'uuid', nullable: true })
  chambreId: string | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
