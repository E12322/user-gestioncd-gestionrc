import { ChambreType } from '@residences/contracts';

/**
 * Loyer mensuel par resident, en TND. Centralise ici pour rester
 * facilement modifiable / branchable sur le service Ressources.
 */
export const MONTANT_MENSUEL_PAR_TYPE: Record<ChambreType, number> = {
  [ChambreType.SIMPLE]: 150,
  [ChambreType.DOUBLE]: 100,
  [ChambreType.STUDIO]: 200,
};
