/**
 * Fin de l'annee academique associee a une date de debut de contrat.
 *
 * Convention SmartCampus : l'annee academique se termine le 31 juillet.
 * Une date de debut a partir du 1er aout appartient a l'annee academique
 * suivante ; sinon elle appartient a l'annee en cours.
 *
 * Exemples (UTC) :
 *  - 2026-09-01 -> 2027-07-31
 *  - 2027-02-01 -> 2027-07-31
 *  - 2026-07-15 -> 2026-07-31
 */
export function getAcademicYearEnd(dateDebut: Date): Date {
  const annee = dateDebut.getUTCFullYear();
  const mois = dateDebut.getUTCMonth();

  const MOIS_RENTREE = 7; // Aout (index 0)
  const anneeFin = mois >= MOIS_RENTREE ? annee + 1 : annee;

  const MOIS_FIN = 6; // Juillet (index 0)
  const JOUR_FIN = 31;

  return new Date(Date.UTC(anneeFin, MOIS_FIN, JOUR_FIN, 23, 59, 59, 999));
}
