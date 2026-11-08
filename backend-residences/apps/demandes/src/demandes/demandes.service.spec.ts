import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEMANDE_ANNULEE, DEMANDE_APPROUVEE } from '@residences/contracts';
import { ChambresHttpClient } from '../chambres-http/chambres-http.client';
import { EVENTS_PUBLISHER, DemandesService } from './demandes.service';
import { DemandeHebergement } from './entities/demande-hebergement.entity';
import { DemandeStatut } from './entities/demande-statut.enum';

type MockRepository = Partial<
  Record<keyof Repository<DemandeHebergement>, jest.Mock>
>;
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

describe('DemandesService', () => {
  let service: DemandesService;
  let repository: MockRepository;
  let chambresService: MockChambresService;
  let eventEmitter: { emit: jest.Mock };

  const baseDemande: DemandeHebergement = {
    id: '22222222-2222-2222-2222-222222222222',
    etudiantId: 'stu-2024-0001',
    statut: DemandeStatut.EN_ATTENTE,
    dateDepot: new Date('2026-10-01T10:00:00.000Z'),
    dateArrivee: new Date('2026-11-01T00:00:00.000Z'),
    dateDepart: new Date('2027-06-30T00:00:00.000Z'),
    chambreId: null,
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
    eventEmitter = { emit: jest.fn(() => ({ subscribe: jest.fn() })) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DemandesService,
        {
          provide: getRepositoryToken(DemandeHebergement),
          useValue: repository,
        },
        { provide: ChambresHttpClient, useValue: chambresService },
        { provide: EVENTS_PUBLISHER, useValue: eventEmitter },
      ],
    }).compile();

    service = moduleRef.get(DemandesService);
  });

  describe('create', () => {
    it('creates a demande in EN_ATTENTE', async () => {
      repository.create!.mockReturnValue(baseDemande);
      repository.save!.mockResolvedValue(baseDemande);

      const result = await service.create({
        etudiantId: baseDemande.etudiantId,
        dateArrivee: baseDemande.dateArrivee.toISOString(),
        dateDepart: baseDemande.dateDepart.toISOString(),
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ statut: DemandeStatut.EN_ATTENTE }),
      );
      expect(result).toEqual(baseDemande);
    });

    it('rejects when dateArrivee is not before dateDepart', async () => {
      await expect(
        service.create({
          etudiantId: baseDemande.etudiantId,
          dateArrivee: '2027-01-01T00:00:00.000Z',
          dateDepart: '2027-01-01T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when dateDepart goes beyond the academic year end', async () => {
      await expect(
        service.create({
          etudiantId: baseDemande.etudiantId,
          dateArrivee: '2026-12-01T00:00:00.000Z',
          dateDepart: '2027-08-15T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a dateDepart exactly at the academic year end', async () => {
      repository.create!.mockReturnValue(baseDemande);
      repository.save!.mockResolvedValue(baseDemande);

      await expect(
        service.create({
          etudiantId: baseDemande.etudiantId,
          dateArrivee: '2026-12-01T00:00:00.000Z',
          dateDepart: '2027-07-31T00:00:00.000Z',
        }),
      ).resolves.toBe(baseDemande);
    });

    it('rejects when the student already has an active demande (EN_ATTENTE)', async () => {
      repository.findOne!.mockResolvedValue({ ...baseDemande });

      await expect(
        service.create({
          etudiantId: baseDemande.etudiantId,
          dateArrivee: '2026-12-01T00:00:00.000Z',
          dateDepart: '2027-06-30T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects when the student already has an APPROUVEE demande', async () => {
      repository.findOne!.mockResolvedValue({
        ...baseDemande,
        statut: DemandeStatut.APPROUVEE,
      });

      await expect(
        service.create({
          etudiantId: baseDemande.etudiantId,
          dateArrivee: '2026-12-01T00:00:00.000Z',
          dateDepart: '2027-06-30T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows a new demande once previous ones are REFUSEE or ANNULEE', async () => {
      repository.findOne!.mockResolvedValue(null);
      repository.create!.mockReturnValue(baseDemande);
      repository.save!.mockResolvedValue(baseDemande);

      await expect(
        service.create({
          etudiantId: baseDemande.etudiantId,
          dateArrivee: '2026-12-01T00:00:00.000Z',
          dateDepart: '2027-06-30T00:00:00.000Z',
        }),
      ).resolves.toBe(baseDemande);
    });

    it('validates the requested chambre exists', async () => {
      repository.create!.mockReturnValue(baseDemande);
      repository.save!.mockResolvedValue(baseDemande);

      await service.create({
        etudiantId: baseDemande.etudiantId,
        dateArrivee: baseDemande.dateArrivee.toISOString(),
        dateDepart: baseDemande.dateDepart.toISOString(),
        chambreId: '33333333-3333-3333-3333-333333333333',
      });

      expect(chambresService.findOne).toHaveBeenCalledWith(
        '33333333-3333-3333-3333-333333333333',
      );
    });
  });

  describe('findAll', () => {
    it('applies filters', async () => {
      repository.find!.mockResolvedValue([baseDemande]);

      await service.findAll({
        statut: DemandeStatut.EN_ATTENTE,
        etudiantId: baseDemande.etudiantId,
      });

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          statut: DemandeStatut.EN_ATTENTE,
          etudiantId: baseDemande.etudiantId,
        },
        order: { dateDepot: 'DESC' },
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

  describe('updateStatut', () => {
    it('approves a demande, occupies the chambre and emits the event', async () => {
      repository.findOne!.mockResolvedValue({ ...baseDemande });
      repository.save!.mockImplementation(async (d) => d);
      chambresService.occuper.mockResolvedValue({});

      const chambreId = '33333333-3333-3333-3333-333333333333';
      const result = await service.updateStatut(baseDemande.id, {
        statut: DemandeStatut.APPROUVEE,
        chambreId,
      });

      expect(chambresService.occuper).toHaveBeenCalledWith(chambreId);
      expect(result.statut).toBe(DemandeStatut.APPROUVEE);
      expect(result.chambreId).toBe(chambreId);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DEMANDE_APPROUVEE,
        expect.objectContaining({ demandeId: baseDemande.id, chambreId }),
      );
    });

    it('requires a chambre to approve', async () => {
      repository.findOne!.mockResolvedValue({ ...baseDemande });

      await expect(
        service.updateStatut(baseDemande.id, {
          statut: DemandeStatut.APPROUVEE,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('propagates a Conflict when the chambre is already occupied', async () => {
      repository.findOne!.mockResolvedValue({ ...baseDemande });
      chambresService.occuper.mockRejectedValue(new ConflictException());

      await expect(
        service.updateStatut(baseDemande.id, {
          statut: DemandeStatut.APPROUVEE,
          chambreId: '33333333-3333-3333-3333-333333333333',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects an invalid transition', async () => {
      repository.findOne!.mockResolvedValue({
        ...baseDemande,
        statut: DemandeStatut.REFUSEE,
      });

      await expect(
        service.updateStatut(baseDemande.id, {
          statut: DemandeStatut.APPROUVEE,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a transition to the same status', async () => {
      repository.findOne!.mockResolvedValue({ ...baseDemande });

      await expect(
        service.updateStatut(baseDemande.id, {
          statut: DemandeStatut.EN_ATTENTE,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects chambreId for a non-approval transition', async () => {
      repository.findOne!.mockResolvedValue({ ...baseDemande });

      await expect(
        service.updateStatut(baseDemande.id, {
          statut: DemandeStatut.REFUSEE,
          chambreId: '33333333-3333-3333-3333-333333333333',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cancels an approved demande, releases the chambre and emits the event', async () => {
      const chambreId = '33333333-3333-3333-3333-333333333333';
      repository.findOne!.mockResolvedValue({
        ...baseDemande,
        statut: DemandeStatut.APPROUVEE,
        chambreId,
      });
      repository.save!.mockImplementation(async (d) => d);
      chambresService.liberer.mockResolvedValue({});

      const result = await service.updateStatut(baseDemande.id, {
        statut: DemandeStatut.ANNULEE,
      });

      expect(chambresService.liberer).toHaveBeenCalledWith(chambreId);
      expect(result.statut).toBe(DemandeStatut.ANNULEE);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DEMANDE_ANNULEE,
        expect.objectContaining({ demandeId: baseDemande.id }),
      );
    });
  });

  describe('identite (passerelle X-User-Id / X-Role)', () => {
    const studentIdentity = { userId: 'stu-2024-0001', role: 'student' };
    const autreEtudiant = { userId: 'stu-2024-9999', role: 'student' };
    const adminIdentity = { userId: 'ADM-0001', role: 'admin' };

    it('force un etudiant a ne lister que ses demandes', async () => {
      repository.find!.mockResolvedValue([baseDemande]);

      await service.findAll({}, studentIdentity);

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            etudiantId: studentIdentity.userId,
          }),
        }),
      );
    });

    it('laisse l admin lister toutes les demandes', async () => {
      repository.find!.mockResolvedValue([baseDemande]);

      await service.findAll({}, adminIdentity);

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ etudiantId: expect.anything() }),
        }),
      );
    });

    it('interdit a un etudiant de voir la demande d un autre (403)', async () => {
      repository.findOne!.mockResolvedValue({
        ...baseDemande,
        etudiantId: 'etu-autre',
      });

      await expect(
        service.findOne(baseDemande.id, studentIdentity),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('interdit a un etudiant d approuver une demande (403)', async () => {
      repository.findOne!.mockResolvedValue({ ...baseDemande });

      await expect(
        service.updateStatut(
          baseDemande.id,
          { statut: DemandeStatut.APPROUVEE, chambreId: 'chambre-uuid' },
          studentIdentity,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('permet au proprietaire d annuler sa demande', async () => {
      repository.findOne!.mockResolvedValue({ ...baseDemande });
      repository.save!.mockImplementation(async (d) => d);

      const result = await service.updateStatut(
        baseDemande.id,
        { statut: DemandeStatut.ANNULEE },
        studentIdentity,
      );

      expect(result.statut).toBe(DemandeStatut.ANNULEE);
    });

    it('interdit a un autre etudiant d annuler une demande (403)', async () => {
      repository.findOne!.mockResolvedValue({ ...baseDemande });

      await expect(
        service.updateStatut(
          baseDemande.id,
          { statut: DemandeStatut.ANNULEE },
          autreEtudiant,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
