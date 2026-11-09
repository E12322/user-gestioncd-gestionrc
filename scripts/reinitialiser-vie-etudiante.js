/*
 * Remet la base « smartcampus_student_life » (clubs, evenements, adhesions) a l'etat de demonstration.
 *
 * Le service Vie etudiante recree ses donnees de demonstration (7 clubs, 7 evenements...) UNIQUEMENT quand la
 * collection des clubs est vide. Si des clubs ont ete supprimes pendant les essais (page Gestion), ce script vide
 * les trois collections ; au redemarrage du service (port 4005), les donnees de depart reviennent.
 *
 *   node scripts/reinitialiser-vie-etudiante.js          # affiche ce qui sera supprime, ne supprime RIEN
 *   node scripts/reinitialiser-vie-etudiante.js --oui    # supprime puis explique la suite
 *
 * ATTENTION : supprime tous les clubs, evenements et adhesions de la base locale (donnees de demonstration).
 * Ne touche jamais aux comptes (base smartcampus_users).
 */
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'SMART-COMPUS-BACK-END-ESPRIT-5SE3', 'node_modules', 'mongodb'));

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB = 'smartcampus_student_life';
const COLLECTIONS = ['clubs', 'events', 'memberships'];

(async () => {
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(DB);
  console.log(`Base ${DB} :`);
  for (const name of COLLECTIONS) {
    const n = await db.collection(name).countDocuments();
    console.log(`  ${name.padEnd(12)} ${n} document(s)`);
  }
  if (!process.argv.includes('--oui')) {
    console.log('\nRien n\'a ete supprime. Pour reinitialiser : node scripts/reinitialiser-vie-etudiante.js --oui');
  } else {
    for (const name of COLLECTIONS) {
      const r = await db.collection(name).deleteMany({});
      console.log(`  supprime : ${name} (${r.deletedCount})`);
    }
    console.log('\nFait. Redemarrer maintenant le service Vie etudiante (port 4005) : il recree les donnees de depart.');
  }
  await client.close();
})().catch((e) => {
  console.error('ECHEC :', e.message);
  process.exit(1);
});
