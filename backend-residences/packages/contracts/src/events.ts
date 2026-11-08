/**
 * Evenements du domaine Residences, publies par le service Demande
 * et consommes par le service Contrat via RabbitMQ.
 */
export const DEMANDE_APPROUVEE = 'demande.approuvee';
export const DEMANDE_ANNULEE = 'demande.annulee';

/** Charge utile de l'evenement demande.approuvee. Les dates circulent en ISO 8601. */
export class DemandeApprouveeEvent {
  constructor(
    readonly demandeId: string,
    readonly etudiantId: string,
    readonly chambreId: string,
    readonly dateDebut: string,
    readonly dateFin: string,
  ) {}
}

/** Charge utile de l'evenement demande.annulee. */
export class DemandeAnnuleeEvent {
  constructor(
    readonly demandeId: string,
    readonly chambreId: string,
  ) {}
}
