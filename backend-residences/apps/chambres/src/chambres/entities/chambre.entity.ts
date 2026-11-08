import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ChambreType } from './chambre-type.enum';

@Entity('chambres')
@Unique('UQ_chambre_batiment_numero', ['batiment', 'numero'])
export class Chambre {
  @ApiProperty({ example: 'c9f1b2a0-1f3e-4d5a-9b6c-7e8f9a0b1c2d' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'A-101' })
  @Column({ type: 'varchar', length: 50 })
  numero: string;

  @ApiProperty({ enum: ChambreType, example: ChambreType.DOUBLE })
  @Column({ type: 'enum', enum: ChambreType })
  type: ChambreType;

  @ApiProperty({ example: 2, minimum: 1, maximum: 4 })
  @Column({ type: 'int' })
  capacite: number;

  @ApiProperty({ example: true, default: true })
  @Column({ type: 'boolean', default: true })
  disponible: boolean;

  @ApiProperty({ example: 'Batiment A' })
  @Column({ type: 'varchar', length: 100 })
  batiment: string;

  @ApiProperty({ example: 1, minimum: 0 })
  @Column({ type: 'int' })
  etage: number;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
