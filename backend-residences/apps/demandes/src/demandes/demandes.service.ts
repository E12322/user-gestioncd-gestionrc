import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DEMANDE_ANNULEE,
  DEMANDE_APPROUVEE,
  DemandeAnnuleeEvent,
  DemandeApprouveeEvent,
  getAcademicYearEnd,
} from '@residences/contracts';
import { ChambresHttpClient } from '../chambres-http/chambres-http.client';
import { Identity } from '../identity/identity';
import { CreateDemandeDto } from './dto/create-demande.dto';
import { FilterDemandeDto } from './dto/filter-demande.dto';
import { UpdateDemandeStatutDto } from './dto/update-demande-statut.dto';
import { DemandeHebergement } from './entities/demande-hebergement.entity';
import { DemandeStatut } from './entities/demande-statut.enum';

export const EVENTS_PUBLISHER = 'EVENTS_PUBLISHER';

const ALLOWED_TRANSITIONS: Record<DemandeStatut, DemandeStatut[]> = {
  [DemandeStatut.EN_ATTENTE]: [
    DemandeStatut.APPROUVEE,
    DemandeStatut.REFUSEE,
    DemandeStatut.ANNULEE,
  ],
  [DemandeStatut.APPROUVEE]: [DemandeStatut.ANNULEE],
  [DemandeStatut.REFUSEE]: [],
  [DemandeStatut.ANNULEE]: [],
};

@Injectable()
export class DemandesService {
  private readonly logger = new Logger(DemandesService.name);

  constructor(
    @InjectRepository(DemandeHebergement)
    private readonly demandesRepository: Repository<DemandeHebergement>,
    private readonly chambresService: ChambresHttpClient,
    @Inject(EVENTS_PUBLISHER) private readonly events: ClientProxy,
  ) {}

  /** L'identite provient de la passerelle (X-User-Id/X-Role) ; sans identite
   *  (appel interne de confiance, tests), dto.etudiantId fait foi. */
  async create(
    dto: CreateDemandeDto,
    identity?: Identity,
  ): Promise<DemandeHebergement> {
    const etudiantId = identity?.userId ?? dto.etudiantId;

    const dateArrivee = new Date(dto.dateArrivee);
    const dateDepart = new Date(dto.dateDepart);
    this.assertDatesValides(dateArrivee, dateDepart);
    this.assertDansAnneeAcademique(dateArrivee, dateDepart);

    await this.assertPasDeDemandeActive(etudiantId);

    if (dto.chambreId) {
      await this.chambresService.findOne(dto.chambreId);
    }

    const demande = this.demandesRepository.create({
      etudiantId,
      dateArrivee,
      dateDepart,
      chambreId: dto.chambreId ?? null,
      statut: DemandeStatut.EN_ATTENTE,
    });

    return this.demandesRepository.save(demande);
  }

  /** Vue admin : toutes les demandes. Vue etudiant : uniquement les siennes. */
  async findAll(
    filter: FilterDemandeDto = {},
    identity?: Identity,
  ): Promise<DemandeHebergement[]> {
    const effective: FilterDemandeDto = { ...filter };
    if (identity && identity.role !== 'admin') {
      effective.etudiantId = identity.userId;
    }
    return this.demandesRepository.find({
      where: this.buildWhere(effective),
      order: { dateDepot: 'DESC' },
    });
  }

  async findOne(id: string, identity?: Identity): Promise<DemandeHebergement> {
    const demande = await this.demandesRepository.findOne({ where: { id } });
    if (!demande) {
      throw new NotFoundException(`Demande ${id} introuvable`);
    }
    this.assertPeutVoir(demande, identity);
    return demande;
  }

  async updateStatut(
    id: string,
    dto: UpdateDemandeStatutDto,
    identity?: Identity,
  ): Promise<DemandeHebergement> {
    const demande = await this.demandesRepository.findOne({ where: { id } });
    if (!demande) {
      throw new NotFoundException(`Demande ${id} introuvable`);
    }
    const { statut } = dto;

    if (statut === demande.statut) {
      throw new ConflictException(
        `La demande ${id} est deja au statut ${statut}`,
      );
    }
    this.assertTransitionAutorisee(demande.statut, statut);
    this.assertTransitionPermise(demande, statut, identity);

    if (statut === DemandeStatut.APPROUVEE) {
      return this.approuver(demande, dto.chambreId);
    }

    if (dto.chambreId) {
      throw new BadRequestException(
        'chambreId ne peut etre fourni que pour une approbation',
      );
    }

    const ancienStatut = demande.statut;
    demande.statut = statut;
    const saved = await this.demandesRepository.save(demande);

    if (
      statut === DemandeStatut.ANNULEE &&
      ancienStatut === DemandeStatut.APPROUVEE &&
      demande.chambreId
    ) {
      await this.chambresService.liberer(demande.chambreId);
      this.publish(
        DEMANDE_ANNULEE,
        new DemandeAnnuleeEvent(demande.id, demande.chambreId),
      );
    }

    return saved;
  }

  private async approuver(
    demande: DemandeHebergement,
    chambreId?: string,
  ): Promise<DemandeHebergement> {
    const chambreAttribuee = chambreId ?? demande.chambreId;
    if (!chambreAttribuee) {
      throw new BadRequestException(
        'chambreId est requis pour approuver une demande',
      );
    }

    await this.chambresService.occuper(chambreAttribuee);

    demande.statut = DemandeStatut.APPROUVEE;
    demande.chambreId = chambreAttribuee;
    const saved = await this.demandesRepository.save(demande);

    this.publish(
      DEMANDE_APPROUVEE,
      new DemandeApprouveeEvent(
        saved.id,
        saved.etudiantId,
        chambreAttribuee,
        saved.dateArrivee.toISOString(),
        saved.dateDepart.toISOString(),
      ),
    );

    return saved;
  }

  /** Publication fire-and-forget vers RabbitMQ : un echec d'evenement ne doit
   *  jamais faire echouer l'approbation (la file durable rejouera au besoin). */
  private publish(pattern: string, payload: unknown): void {
    try {
      this.events.emit(pattern, payload).subscribe({
        error: (error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Publication ${pattern} impossible : ${message}`);
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Publication ${pattern} impossible : ${message}`);
    }
  }

  private buildWhere(filter: FilterDemandeDto) {
    const where: Record<string, unknown> = {};
    if (filter.statut !== undefined) where.statut = filter.statut;
    if (filter.etudiantId !== undefined) where.etudiantId = filter.etudiantId;
    if (filter.chambreId !== undefined) where.chambreId = filter.chambreId;
    return where;
  }

  private assertPeutVoir(
    demande: DemandeHebergement,
    identity?: Identity,
  ): void {
    if (!identity || identity.role === 'admin') return;
    if (demande.etudiantId !== identity.userId) {
      throw new ForbiddenException(
        "Cette demande n'est pas la votre (acces reserve a son proprietaire ou a l'admin)",
      );
    }
  }

  /** Approbation/refus : admin. Annulation : admin ou proprietaire. */
  private assertTransitionPermise(
    demande: DemandeHebergement,
    statut: DemandeStatut,
    identity?: Identity,
  ): void {
    if (!identity || identity.role === 'admin') return;

    if (
      statut === DemandeStatut.APPROUVEE ||
      statut === DemandeStatut.REFUSEE
    ) {
      throw new ForbiddenException(
        "L'approbation et le refus d'une demande sont reserves a l'administrateur",
      );
    }
    if (
      statut === DemandeStatut.ANNULEE &&
      demande.etudiantId !== identity.userId
    ) {
      throw new ForbiddenException(
        "Cette demande n'est pas la votre (acces reserve a son proprietaire ou a l'admin)",
      );
    }
  }

  private assertDatesValides(dateArrivee: Date, dateDepart: Date): void {
    if (
      Number.isNaN(dateArrivee.getTime()) ||
      Number.isNaN(dateDepart.getTime())
    ) {
      throw new BadRequestException('Dates invalides');
    }
    if (dateArrivee >= dateDepart) {
      throw new BadRequestException(
        'dateArrivee doit etre strictement anterieure a dateDepart',
      );
    }
  }

  private assertDansAnneeAcademique(dateArrivee: Date, dateDepart: Date): void {
    const finAnneeAcademique = getAcademicYearEnd(dateArrivee);
    if (dateDepart > finAnneeAcademique) {
      throw new BadRequestException(
        `dateDepart (${dateDepart.toISOString()}) depasse la fin de l annee academique (${finAnneeAcademique.toISOString()})`,
      );
    }
  }

  /** Un etudiant ne peut avoir qu'une demande active (EN_ATTENTE ou APPROUVEE) : une chambre a la fois. */
  private async assertPasDeDemandeActive(etudiantId: string): Promise<void> {
    const active = await this.demandesRepository.findOne({
      where: [
        { etudiantId, statut: DemandeStatut.EN_ATTENTE },
        { etudiantId, statut: DemandeStatut.APPROUVEE },
      ],
    });
    if (active) {
      throw new ConflictException(
        `L etudiant ${etudiantId} a deja une demande active (${active.statut})`,
      );
    }
  }

  private assertTransitionAutorisee(
    actuel: DemandeStatut,
    cible: DemandeStatut,
  ): void {
    if (!ALLOWED_TRANSITIONS[actuel].includes(cible)) {
      throw new ConflictException(
        `Transition ${actuel} -> ${cible} non autorisee`,
      );
    }
  }
}
