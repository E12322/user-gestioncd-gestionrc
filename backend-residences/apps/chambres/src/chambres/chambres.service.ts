import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chambre } from './entities/chambre.entity';
import { ChambreType } from './entities/chambre-type.enum';
import { CreateChambreDto } from './dto/create-chambre.dto';
import { UpdateChambreDto } from './dto/update-chambre.dto';
import { FilterChambreDto } from './dto/filter-chambre.dto';

@Injectable()
export class ChambresService {
  constructor(
    @InjectRepository(Chambre)
    private readonly chambresRepository: Repository<Chambre>,
  ) {}

  async create(dto: CreateChambreDto): Promise<Chambre> {
    this.assertCapaciteCoherent(dto.type, dto.capacite);
    await this.assertUnique(dto.batiment, dto.numero);

    const chambre = this.chambresRepository.create({
      ...dto,
      disponible: dto.disponible ?? true,
    });

    return this.chambresRepository.save(chambre);
  }

  async findAll(filter: FilterChambreDto = {}): Promise<Chambre[]> {
    return this.chambresRepository.find({
      where: this.buildWhere(filter),
      order: { batiment: 'ASC', numero: 'ASC' },
    });
  }

  async findDisponibles(filter: FilterChambreDto = {}): Promise<Chambre[]> {
    return this.findAll({ ...filter, disponible: true });
  }

  async findOne(id: string): Promise<Chambre> {
    const chambre = await this.chambresRepository.findOne({ where: { id } });
    if (!chambre) {
      throw new NotFoundException(`Chambre ${id} introuvable`);
    }
    return chambre;
  }

  async update(id: string, dto: UpdateChambreDto): Promise<Chambre> {
    const chambre = await this.findOne(id);

    const type = dto.type ?? chambre.type;
    const capacite = dto.capacite ?? chambre.capacite;
    this.assertCapaciteCoherent(type, capacite);

    const batiment = dto.batiment ?? chambre.batiment;
    const numero = dto.numero ?? chambre.numero;
    if (batiment !== chambre.batiment || numero !== chambre.numero) {
      await this.assertUnique(batiment, numero, id);
    }

    Object.assign(chambre, dto);
    return this.chambresRepository.save(chambre);
  }

  async remove(id: string): Promise<void> {
    const chambre = await this.findOne(id);
    await this.chambresRepository.remove(chambre);
  }

  /**
   * Marks a chambre as occupied. The update is conditional on the chambre
   * still being available, so two concurrent assignments cannot both win.
   * Throws NotFound if the chambre does not exist, Conflict if already taken.
   */
  async occuper(id: string): Promise<Chambre> {
    const result = await this.chambresRepository.update(
      { id, disponible: true },
      { disponible: false },
    );

    if (!result.affected) {
      await this.findOne(id);
      throw new ConflictException(`La chambre ${id} est deja occupee`);
    }

    return this.findOne(id);
  }

  /**
   * Releases a chambre (idempotent): makes it available again.
   */
  async liberer(id: string): Promise<Chambre> {
    const chambre = await this.findOne(id);
    if (!chambre.disponible) {
      chambre.disponible = true;
      return this.chambresRepository.save(chambre);
    }
    return chambre;
  }

  private buildWhere(filter: FilterChambreDto) {
    const where: Record<string, unknown> = {};
    if (filter.type !== undefined) where.type = filter.type;
    if (filter.batiment !== undefined) where.batiment = filter.batiment;
    if (filter.disponible !== undefined) where.disponible = filter.disponible;
    return where;
  }

  private async assertUnique(
    batiment: string,
    numero: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.chambresRepository.findOne({
      where: { batiment, numero },
    });
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(
        `La chambre ${numero} du ${batiment} existe deja`,
      );
    }
  }

  private assertCapaciteCoherent(type: ChambreType, capacite: number): void {
    const rules: Record<ChambreType, (c: number) => boolean> = {
      [ChambreType.SIMPLE]: (c) => c === 1,
      [ChambreType.DOUBLE]: (c) => c === 2,
      [ChambreType.STUDIO]: (c) => c >= 1 && c <= 2,
    };

    if (!rules[type](capacite)) {
      throw new BadRequestException(
        `Capacite ${capacite} invalide pour une chambre de type ${type}`,
      );
    }
  }
}
