/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Seed de demonstration — reconstruit le jeu de donnees du mode mock via
 * l'API de la passerelle (http://localhost:3001/api) :
 *
 *   1. 28 chambres (Batiments A/B/C, capacites coherentes)
 *   2. 6 demandes dont :
 *      - Yasmine ETU-2024-0187 : EN_ATTENTE (demande annulable)
 *      - Amine ETU-2024-0211   : EN_ATTENTE
 *      - Ines ETU-2024-0302    : APPROUVEE + chambre A-002 + contrat ACTIF
 *      - Omar ETU-2023-0644    : REFUSEE
 *      - Rim ETU-2025-0019     : ANNULEE
 *      - Mariem ETU-2024-0455  : APPROUVEE + chambre B-001 + contrat ACTIF
 *
 * Les approbations passent par le vrai flux : demande deposee par l'etudiant,
 * chambre occupee par le service Chambres, contrat cree par le service Contrats
 * en consommant l'evenement RabbitMQ. Le seed est donc aussi une preuve
 * d'integration bout-en-bout.
 *
 * Prerequis : PostgreSQL + RabbitMQ demarres, les 4 applications lancees
 * (npm run start:dev a la racine).
 *
 * Idempotent : chaque etape verifie l'etat existant avant d'ecrire.
 * Usage : npm run seed
 */
const { config } = require('dotenv');
const path = require('path');

config({ path: path.resolve(__dirname, '..', '.env') });

const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:3001/api';

const b64 = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '');

/** Jeton de demonstration au format du front ({ sub, name, role }, alg none). */
function demoToken(userId: string, name: string, role: 'student' | 'admin'): string {
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: userId, name, role })}.demo`;
}

const ADMIN = { id: 'ADM-0001', name: 'Sonia Gharbi' };

async function api<T>(
  method: string,
  url: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; json?: T }> {
  const res = await fetch(`${GATEWAY}${url}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  return { status: res.status, json: json as T };
}

interface Chambre {
  id: string;
  numero: string;
  batiment: string;
}
interface Demande {
  id: string;
  etudiantId: string;
  statut: string;
}

const BATIMENTS: { prefix: string; name: string; floors: number }[] = [
  { prefix: 'A', name: 'Bâtiment A', floors: 3 },
  { prefix: 'B', name: 'Bâtiment B', floors: 2 },
  { prefix: 'C', name: 'Bâtiment C', floors: 2 },
];

function buildChambres() {
  const rooms: { numero: string; type: 'SIMPLE' | 'DOUBLE' | 'STUDIO'; capacite: number; batiment: string; etage: number }[] = [];
  for (const b of BATIMENTS) {
    for (let floor = 0; floor < b.floors; floor++) {
      for (let slot = 1; slot <= 4; slot++) {
        const numero = `${b.prefix}-${floor}${String(slot).padStart(2, '0')}`;
        const type = slot === 1 ? 'SIMPLE' : slot === 4 ? 'STUDIO' : 'DOUBLE';
        rooms.push({ numero, type, capacite: type === 'DOUBLE' ? 2 : 1, batiment: b.name, etage: floor });
      }
    }
  }
  return rooms;
}

async function main(): Promise<void> {
  console.log(`Seed via la passerelle : ${GATEWAY}`);

  const health = await api<Record<string, string>>('GET', '/health');
  if (health.status !== 200) throw new Error(`Passerelle injoignable (${health.status})`);
  const down = Object.entries(health.json ?? {}).filter(([, s]) => s !== 'up');
  if (down.length) throw new Error(`Services indisponibles : ${down.map(([n, s]) => `${n}=${s}`).join(', ')}`);
  console.log('Sante des services : tous up');

  // ------------------------------------------------------------------
  // 1. Chambres
  // ------------------------------------------------------------------
  const adminTok = demoToken(ADMIN.id, ADMIN.name, 'admin');
  const existingRooms = (await api<Chambre[]>('GET', '/chambres', undefined, adminTok)).json ?? [];
  let created = 0;
  for (const room of buildChambres()) {
    if (existingRooms.some((r) => r.numero === room.numero && r.batiment === room.batiment)) continue;
    const res = await api('POST', '/chambres', room, adminTok);
    if (res.status !== 201) throw new Error(`Creation chambre ${room.numero} echouee (${res.status}) : ${JSON.stringify(res.json)}`);
    created++;
  }
  console.log(`Chambres : ${created} creee(s) (total ${(await api<Chambre[]>('GET', '/chambres', undefined, adminTok)).json?.length})`);

  const rooms = (await api<Chambre[]>('GET', '/chambres', undefined, adminTok)).json ?? [];
  const roomByNumero = new Map(rooms.map((r) => [r.numero, r]));

  // ------------------------------------------------------------------
  // 2. Demandes (depot par l'etudiant, approbation par l'admin)
  // ------------------------------------------------------------------
  interface SeedDemande {
    etudiantId: string;
    name: string;
    arrivee: string;
    depart: string;
    chambre?: string;   // chambre souaitee/attribuee
    statut: 'EN_ATTENTE' | 'APPROUVEE' | 'REFUSEE' | 'ANNULEE';
  }
  const SEED: SeedDemande[] = [
    { etudiantId: 'ETU-2024-0187', name: 'Yasmine Ben Salah', arrivee: '2026-11-01', depart: '2027-06-30', statut: 'EN_ATTENTE' },
    { etudiantId: 'ETU-2024-0211', name: 'Amine Khelifi', arrivee: '2026-10-20', depart: '2027-06-30', statut: 'EN_ATTENTE' },
    { etudiantId: 'ETU-2024-0302', name: 'Inès Bouzid', arrivee: '2026-09-01', depart: '2027-06-30', chambre: 'A-002', statut: 'APPROUVEE' },
    { etudiantId: 'ETU-2023-0644', name: 'Omar Dridi', arrivee: '2026-10-01', depart: '2027-01-31', statut: 'REFUSEE' },
    { etudiantId: 'ETU-2025-0019', name: 'Rim Zouari', arrivee: '2026-10-01', depart: '2027-06-30', statut: 'ANNULEE' },
    { etudiantId: 'ETU-2024-0455', name: 'Mariem Sfaxi', arrivee: '2026-10-01', depart: '2027-06-30', chambre: 'B-001', statut: 'APPROUVEE' },
  ];

  let demandesCreated = 0;
  for (const s of SEED) {
    const studentTok = demoToken(s.etudiantId, s.name, 'student');

    // deja presente ? (regle : une demande active au plus par etudiant)
    const mine = (await api<Demande[]>('GET', `/demandes?etudiantId=${encodeURIComponent(s.etudiantId)}`, undefined, adminTok)).json ?? [];
    if (mine.some((d) => d.statut === 'EN_ATTENTE' || d.statut === 'APPROUVEE')) continue;
    if (s.statut === 'REFUSEE' && mine.some((d) => d.statut === 'REFUSEE')) continue;
    if (s.statut === 'ANNULEE' && mine.some((d) => d.statut === 'ANNULEE')) continue;

    const body: Record<string, unknown> = {
      etudiantId: s.etudiantId,
      dateArrivee: s.arrivee,
      dateDepart: s.depart,
      ...(s.chambre ? { chambreId: roomByNumero.get(s.chambre)?.id } : {}),
    };
    const res = await api<Demande>('POST', '/demandes', body, studentTok);
    if (res.status !== 201) throw new Error(`Depot ${s.etudiantId} echoue (${res.status}) : ${JSON.stringify(res.json)}`);
    demandesCreated++;

    const demande = res.json!;
    if (s.statut === 'EN_ATTENTE') continue;

    if (s.statut === 'REFUSEE') {
      const patch = await api('PATCH', `/demandes/${demande.id}/statut`, { statut: 'REFUSEE' }, adminTok);
      if (patch.status !== 200) throw new Error(`Refus ${s.etudiantId} echoue (${patch.status})`);
      continue;
    }
    if (s.statut === 'ANNULEE') {
      // annulee par son proprietaire : teste aussi la regle de propriete
      const patch = await api('PATCH', `/demandes/${demande.id}/statut`, { statut: 'ANNULEE' }, studentTok);
      if (patch.status !== 200) throw new Error(`Annulation ${s.etudiantId} echoue (${patch.status}) : ${JSON.stringify(patch.json)}`);
      continue;
    }
    if (s.statut === 'APPROUVEE') {
      const patch = await api(
        'PATCH',
        `/demandes/${demande.id}/statut`,
        { statut: 'APPROUVEE', chambreId: roomByNumero.get(s.chambre!)?.id },
        adminTok,
      );
      if (patch.status !== 200) throw new Error(`Approbation ${s.etudiantId} echouee (${patch.status}) : ${JSON.stringify(patch.json)}`);
      // le contrat est cree par le service Contrats via RabbitMQ
    }
  }
  console.log(`Demandes : ${demandesCreated} creee(s) via l'API`);

  // attend que le consommateur Contrats traite les evenements RabbitMQ
  await new Promise((r) => setTimeout(r, 2500));

  const contrats = (await api<Demande[]>('GET', '/contrats', undefined, adminTok)).json ?? [];
  console.log(`Contrats ACTIF attendus : 2 — contrats en base : ${contrats.length}`);
  if (contrats.length < 2) throw new Error('Les contrats ne sont pas tous crees (verifier RabbitMQ et le service Contrats)');

  console.log('Seed termine : 28 chambres, 6 demandes, 2 contrats ACTIF.');
}

main().catch((error) => {
  console.error('[seed] Echec :', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
