import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DemandeAnnuleeEvent,
  DemandeApprouveeEvent,
  getAcademicYearEnd,
} from '@residences/contracts';
import { ChambresHttpClient } from '../chambres-http/chambres-http.client';
import { MONTANT_MENSUEL_PAR_TYPE } from './constants/pricing.constants';
import { FilterContratDto } from './dto/filter-contrat.dto';
import { Contrat } from './entities/contrat.entity';
import { ContratStatut } from './entities/contrat-statut.enum';

export interface CreateContratParams {
  demandeId: string;
  residentId: string;
  chambreId: string;
  dateDebut: Date;
  dateFin: Date;
}

@Injectable()
export class ContratsService {
  private readonly logger = new Logger(ContratsService.name);

  constructor(
    @InjectRepository(Contrat)
    private readonly contratsRepository: Repository<Contrat>,
    private readonly chambresService: ChambresHttpClient,
  ) {}

  /**
   * Creates the contract attached to an approved demande.
   * Idempotent: a demande can only ever produce one contract — le consommateur
   * peut donc rejouer l'evenement (file durable RabbitMQ) sans duplicate.
   */
  async createFromDemande(params: CreateContratParams): Promise<Contrat> {
    const existing = await this.contratsRepository.findOne({
      where: { demandeId: params.demandeId },
    });
    if (existing) {
      this.logger.warn(
        `Un contrat existe deja pour la demande ${params.demandeId}, creation ignoree`,
      );
      return existing;
    }

    this.assertDatesValides(params.dateDebut, params.dateFin);

    const chambre = await this.chambresService.findOne(params.chambreId);
    const montantMensuel = MONTANT_MENSUEL_PAR_TYPE[chambre.type];

    const contrat = this.contratsRepository.create({
      demandeId: params.demandeId,
      residentId: params.residentId,
      chambreId: params.chambreId,
      dateDebut: params.dateDebut,
      dateFin: params.dateFin,
      montantMensuel,
      statut: ContratStatut.ACTIF,
    });

    return this.contratsRepository.save(contrat);
  }

  async findAll(filter: FilterContratDto = {}): Promise<Contrat[]> {
    return this.contratsRepository.find({
      where: this.buildWhere(filter),
      order: { dateDebut: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Contrat> {
    const contrat = await this.contratsRepository.findOne({ where: { id } });
    if (!contrat) {
      throw new NotFoundException(`Contrat ${id} introuvable`);
    }
    return contrat;
  }

  async findByResident(
    residentId: string,
    statut?: ContratStatut,
  ): Promise<Contrat[]> {
    return this.findAll({ residentId, statut });
  }

  async resilier(id: string): Promise<Contrat> {
    const contrat = await this.findOne(id);

    if (contrat.statut !== ContratStatut.ACTIF) {
      throw new ConflictException(
        `Le contrat ${id} n est pas actif (statut: ${contrat.statut})`,
      );
    }

    contrat.statut = ContratStatut.RESILIE;
    const saved = await this.contratsRepository.save(contrat);

    await this.chambresService.liberer(contrat.chambreId);

    return saved;
  }

  /** Consume demande.approuvee (RabbitMQ) : cree le contrat. */
  async onDemandeApprouvee(event: DemandeApprouveeEvent): Promise<void> {
    try {
      await this.createFromDemande({
        demandeId: event.demandeId,
        residentId: event.etudiantId,
        chambreId: event.chambreId,
        dateDebut: new Date(event.dateDebut),
        dateFin: new Date(event.dateFin),
      });
      this.logger.log(
        `Contrat cree pour la demande ${event.demandeId} (chambre ${event.chambreId})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Echec de creation du contrat pour la demande ${event.demandeId}: ${message}`,
      );
    }
  }

  /** Consume demande.annulee (RabbitMQ) : resilie le contrat associe. */
  async onDemandeAnnulee(event: DemandeAnnuleeEvent): Promise<void> {
    try {
      const contrat = await this.contratsRepository.findOne({
        where: { demandeId: event.demandeId },
      });

      if (!contrat) {
        this.logger.warn(
          `Aucun contrat a resilier pour la demande annulee ${event.demandeId}`,
        );
        return;
      }

      if (contrat.statut === ContratStatut.ACTIF) {
        contrat.statut = ContratStatut.RESILIE;
        await this.contratsRepository.save(contrat);
        this.logger.log(
          `Contrat ${contrat.id} resilie suite a l annulation de la demande ${event.demandeId}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Echec de resiliation du contrat pour la demande ${event.demandeId}: ${message}`,
      );
    }
  }

  private buildWhere(filter: FilterContratDto) {
    const where: Record<string, unknown> = {};
    if (filter.statut !== undefined) where.statut = filter.statut;
    if (filter.residentId !== undefined) where.residentId = filter.residentId;
    if (filter.chambreId !== undefined) where.chambreId = filter.chambreId;
    if (filter.demandeId !== undefined) where.demandeId = filter.demandeId;
    return where;
  }

  private assertDatesValides(dateDebut: Date, dateFin: Date): void {
    if (Number.isNaN(dateDebut.getTime()) || Number.isNaN(dateFin.getTime())) {
      throw new BadRequestException('Dates invalides');
    }
    if (dateFin <= dateDebut) {
      throw new BadRequestException(
        'dateFin doit etre strictement posterieure a dateDebut',
      );
    }

    const finAnneeAcademique = getAcademicYearEnd(dateDebut);
    if (dateFin > finAnneeAcademique) {
      throw new BadRequestException(
        `dateFin depasse la fin de l annee academique (${finAnneeAcademique
          .toISOString()
          .slice(0, 10)})`,
      );
    }
  }
}
