import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getAcademicYearEnd } from '@residences/contracts';
import {
  ChambresHttpClient,
  type ChambreView,
} from '../chambres-http/chambres-http.client';

import { ContratsService } from './contrats.service';
import { Contrat } from './entities/contrat.entity';
import { ContratStatut } from './entities/contrat-statut.enum';

type MockRepository = Partial<Record<keyof Repository<Contrat>, jest.Mock>>;
type MockChambresService = {
  findOne: jest.Mock;
  occuper: jest.Mock;
  liberer: jest.Mock;
};

const createMockRepository = (): MockRepository => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
});

describe('ContratsService', () => {
  let service: ContratsService;
  let repository: MockRepository;
  let chambresService: MockChambresService;

  const chambre: ChambreView = {
    id: '33333333-3333-3333-3333-333333333333',
    numero: 'B-201',
    type: 'DOUBLE' as const,
    capacite: 2,
    disponible: false,
    batiment: 'Batiment B',
    etage: 2,
  };

  const baseContrat: Contrat = {
    id: '44444444-4444-4444-4444-444444444444',
    residentId: 'stu-2024-0001',
    chambreId: chambre.id,
    demandeId: '22222222-2222-2222-2222-222222222222',
    dateDebut: new Date('2026-09-01T00:00:00.000Z'),
    dateFin: new Date('2027-06-30T00:00:00.000Z'),
    montantMensuel: 100,
    statut: ContratStatut.ACTIF,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = createMockRepository();
    chambresService = {
      findOne: jest.fn(),
      occuper: jest.fn(),
      liberer: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ContratsService,
        { provide: getRepositoryToken(Contrat), useValue: repository },
        { provide: ChambresHttpClient, useValue: chambresService },
      ],
    }).compile();

    service = moduleRef.get(ContratsService);
  });

  describe('createFromDemande', () => {
    it('creates an ACTIF contract priced from the chambre type', async () => {
      repository.findOne!.mockResolvedValue(null);
      repository.create!.mockReturnValue(baseContrat);
      repository.save!.mockResolvedValue(baseContrat);
      chambresService.findOne.mockResolvedValue(chambre);

      const result = await service.createFromDemande({
        demandeId: baseContrat.demandeId,
        residentId: baseContrat.residentId,
        chambreId: baseContrat.chambreId,
        dateDebut: baseContrat.dateDebut,
        dateFin: baseContrat.dateFin,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          montantMensuel: 100,
          statut: ContratStatut.ACTIF,
        }),
      );
      expect(result).toEqual(baseContrat);
    });

    it('is idempotent: returns the existing contract without saving', async () => {
      repository.findOne!.mockResolvedValue(baseContrat);

      const result = await service.createFromDemande({
        demandeId: baseContrat.demandeId,
        residentId: baseContrat.residentId,
        chambreId: baseContrat.chambreId,
        dateDebut: baseContrat.dateDebut,
        dateFin: baseContrat.dateFin,
      });

      expect(result).toEqual(baseContrat);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects dateFin not after dateDebut', async () => {
      repository.findOne!.mockResolvedValue(null);

      await expect(
        service.createFromDemande({
          demandeId: baseContrat.demandeId,
          residentId: baseContrat.residentId,
          chambreId: baseContrat.chambreId,
          dateDebut: new Date('2026-09-01T00:00:00.000Z'),
          dateFin: new Date('2026-09-01T00:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a dateFin beyond the academic year end', async () => {
      repository.findOne!.mockResolvedValue(null);

      await expect(
        service.createFromDemande({
          demandeId: baseContrat.demandeId,
          residentId: baseContrat.residentId,
          chambreId: baseContrat.chambreId,
          dateDebut: new Date('2026-09-01T00:00:00.000Z'),
          dateFin: new Date('2027-08-01T00:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a dateFin exactly at the academic year end', async () => {
      repository.findOne!.mockResolvedValue(null);
      repository.create!.mockImplementation((data) => data as Contrat);
      repository.save!.mockImplementation(async (data) => data);
      chambresService.findOne.mockResolvedValue(chambre);

      const result = await service.createFromDemande({
        demandeId: baseContrat.demandeId,
        residentId: baseContrat.residentId,
        chambreId: baseContrat.chambreId,
        dateDebut: new Date('2026-09-01T00:00:00.000Z'),
        dateFin: getAcademicYearEnd(new Date('2026-09-01T00:00:00.000Z')),
      });

      expect(result.statut).toBe(ContratStatut.ACTIF);
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

  describe('findByResident', () => {
    it('filters by resident and statut', async () => {
      repository.find!.mockResolvedValue([baseContrat]);

      await service.findByResident(baseContrat.residentId, ContratStatut.ACTIF);

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          residentId: baseContrat.residentId,
          statut: ContratStatut.ACTIF,
        },
        order: { dateDebut: 'DESC' },
      });
    });
  });

  describe('resilier', () => {
    it('resilie an ACTIF contract and frees the chambre', async () => {
      repository.findOne!.mockResolvedValue({ ...baseContrat });
      repository.save!.mockImplementation(async (data) => data);
      chambresService.liberer.mockResolvedValue({});

      const result = await service.resilier(baseContrat.id);

      expect(result.statut).toBe(ContratStatut.RESILIE);
      expect(chambresService.liberer).toHaveBeenCalledWith(
        baseContrat.chambreId,
      );
    });

    it('rejects when the contract is not active', async () => {
      repository.findOne!.mockResolvedValue({
        ...baseContrat,
        statut: ContratStatut.RESILIE,
      });

      await expect(service.resilier(baseContrat.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('event listeners', () => {
    it('creates a contract when a demande is approved', async () => {
      repository.findOne!.mockResolvedValue(null);
      repository.create!.mockReturnValue(baseContrat);
      repository.save!.mockResolvedValue(baseContrat);
      chambresService.findOne.mockResolvedValue(chambre);

      await service.onDemandeApprouvee({
        demandeId: baseContrat.demandeId,
        etudiantId: baseContrat.residentId,
        chambreId: baseContrat.chambreId,
        dateDebut: baseContrat.dateDebut.toISOString(),
        dateFin: baseContrat.dateFin.toISOString(),
      });

      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('swallows errors so the demande approval is not broken', async () => {
      repository.findOne!.mockResolvedValue(null);
      chambresService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.onDemandeApprouvee({
          demandeId: baseContrat.demandeId,
          etudiantId: baseContrat.residentId,
          chambreId: 'missing',
          dateDebut: baseContrat.dateDebut.toISOString(),
          dateFin: baseContrat.dateFin.toISOString(),
        }),
      ).resolves.toBeUndefined();
    });

    it('resilies the linked contract when the demande is cancelled', async () => {
      repository.findOne!.mockResolvedValue({ ...baseContrat });
      repository.save!.mockImplementation(async (data) => data);

      await service.onDemandeAnnulee({
        demandeId: baseContrat.demandeId,
        chambreId: baseContrat.chambreId,
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ statut: ContratStatut.RESILIE }),
      );
    });

    it('does nothing when the cancelled demande has no contract', async () => {
      repository.findOne!.mockResolvedValue(null);

      await service.onDemandeAnnulee({
        demandeId: 'unknown',
        chambreId: 'chambre-inconnue',
      });

      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
