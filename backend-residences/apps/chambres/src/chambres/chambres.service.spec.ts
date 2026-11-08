import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChambresService } from './chambres.service';
import { Chambre } from './entities/chambre.entity';
import { ChambreType } from './entities/chambre-type.enum';

type MockRepository = Partial<Record<keyof Repository<Chambre>, jest.Mock>>;

const createMockRepository = (): MockRepository => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  update: jest.fn(),
});

describe('ChambresService', () => {
  let service: ChambresService;
  let repository: MockRepository;

  const baseChambre: Chambre = {
    id: '11111111-1111-1111-1111-111111111111',
    numero: 'A-101',
    type: ChambreType.DOUBLE,
    capacite: 2,
    disponible: true,
    batiment: 'Batiment A',
    etage: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = createMockRepository();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChambresService,
        { provide: getRepositoryToken(Chambre), useValue: repository },
      ],
    }).compile();

    service = moduleRef.get(ChambresService);
  });

  describe('create', () => {
    it('creates a chambre when data is valid', async () => {
      repository.findOne!.mockResolvedValue(null);
      repository.create!.mockReturnValue(baseChambre);
      repository.save!.mockResolvedValue(baseChambre);

      const result = await service.create({
        numero: 'A-101',
        type: ChambreType.DOUBLE,
        capacite: 2,
        batiment: 'Batiment A',
        etage: 1,
      });

      expect(result).toEqual(baseChambre);
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('rejects an incoherent capacity for the type', async () => {
      await expect(
        service.create({
          numero: 'A-102',
          type: ChambreType.SIMPLE,
          capacite: 2,
          batiment: 'Batiment A',
          etage: 1,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate (batiment, numero)', async () => {
      repository.findOne!.mockResolvedValue(baseChambre);

      await expect(
        service.create({
          numero: 'A-101',
          type: ChambreType.DOUBLE,
          capacite: 2,
          batiment: 'Batiment A',
          etage: 1,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findDisponibles', () => {
    it('queries only available chambres', async () => {
      repository.find!.mockResolvedValue([baseChambre]);

      const result = await service.findDisponibles({
        type: ChambreType.DOUBLE,
      });

      expect(result).toEqual([baseChambre]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { type: ChambreType.DOUBLE, disponible: true },
        order: { batiment: 'ASC', numero: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFound when missing', async () => {
      repository.findOne!.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('removes an existing chambre', async () => {
      repository.findOne!.mockResolvedValue(baseChambre);
      repository.remove!.mockResolvedValue(baseChambre);

      await service.remove(baseChambre.id);

      expect(repository.remove).toHaveBeenCalledWith(baseChambre);
    });
  });

  describe('occuper', () => {
    it('marks an available chambre as occupied', async () => {
      repository.update!.mockResolvedValue({ affected: 1 });
      repository.findOne!.mockResolvedValue({
        ...baseChambre,
        disponible: false,
      });

      const result = await service.occuper(baseChambre.id);

      expect(repository.update).toHaveBeenCalledWith(
        { id: baseChambre.id, disponible: true },
        { disponible: false },
      );
      expect(result.disponible).toBe(false);
    });

    it('throws Conflict when the chambre is already occupied', async () => {
      repository.update!.mockResolvedValue({ affected: 0 });
      repository.findOne!.mockResolvedValue({
        ...baseChambre,
        disponible: false,
      });

      await expect(service.occuper(baseChambre.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws NotFound when the chambre does not exist', async () => {
      repository.update!.mockResolvedValue({ affected: 0 });
      repository.findOne!.mockResolvedValue(null);

      await expect(service.occuper('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('liberer', () => {
    it('releases an occupied chambre', async () => {
      const occupee = { ...baseChambre, disponible: false };
      repository.findOne!.mockResolvedValue(occupee);
      repository.save!.mockResolvedValue({ ...occupee, disponible: true });

      const result = await service.liberer(baseChambre.id);

      expect(result.disponible).toBe(true);
    });

    it('is a no-op when the chambre is already available', async () => {
      repository.findOne!.mockResolvedValue(baseChambre);

      const result = await service.liberer(baseChambre.id);

      expect(result).toEqual(baseChambre);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
