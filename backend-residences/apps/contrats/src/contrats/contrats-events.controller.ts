import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import {
  DEMANDE_ANNULEE,
  DEMANDE_APPROUVEE,
  DemandeAnnuleeEvent,
  DemandeApprouveeEvent,
} from '@residences/contracts';
import { ContratsService } from './contrats.service';

/**
 * Consommateur RabbitMQ (expose les patterns du service Contrat).
 * Les @EventPattern doivent vivre sur un @Controller() : l'exploration des
 * ecouteurs de @nestjs/microservices ne scanne que les controleurs.
 * Le traitement metier reste dans ContratsService.
 */
@Controller()
export class ContratsEventsController {
  constructor(private readonly contratsService: ContratsService) {}

  @EventPattern(DEMANDE_APPROUVEE)
  onDemandeApprouvee(event: DemandeApprouveeEvent): Promise<void> {
    return this.contratsService.onDemandeApprouvee(event);
  }

  @EventPattern(DEMANDE_ANNULEE)
  onDemandeAnnulee(event: DemandeAnnuleeEvent): Promise<void> {
    return this.contratsService.onDemandeAnnulee(event);
  }
}
