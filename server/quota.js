const { db } = require('./db');

// Nombre d'« unités » IA autorisées par utilisateur et par jour (une analyse = 1, une recherche d'offres = 3).
const LIMIT = Number(process.env.AI_DAILY_LIMIT) || 40;
// Plafond pour l'ensemble des utilisateurs : protège le budget API quel que soit le nombre de comptes.
const GLOBAL_LIMIT = Number(process.env.GLOBAL_DAILY_LIMIT) || 300;
const COST = { analyze: 1, tool: 1, skills: 1, bestCv: 1, suggest: 3 };

const today = () => new Date().toISOString().slice(0, 10);

function used(userId) {
  const row = db.prepare('SELECT units FROM usage WHERE user_id = ? AND day = ?').get(userId, today());
  return row ? row.units : 0;
}

function usedGlobally() {
  return db.prepare('SELECT COALESCE(SUM(units), 0) AS n FROM usage WHERE day = ?').get(today()).n;
}

// Renvoie null si l'action est autorisée (et la décompte), sinon le message à afficher.
function consume(userId, units) {
  if (used(userId) + units > LIMIT) {
    return `Limite quotidienne atteinte (${LIMIT} crédits IA par jour). Elle se réinitialise à minuit (UTC).`;
  }
  if (usedGlobally() + units > GLOBAL_LIMIT) {
    return "Le service a atteint sa limite d'utilisation pour aujourd'hui. Réessayez demain.";
  }
  db.prepare(`INSERT INTO usage (user_id, day, units) VALUES (?, ?, ?)
    ON CONFLICT (user_id, day) DO UPDATE SET units = units + excluded.units`).run(userId, today(), units);
  return null;
}

// Rend les unités si l'appel à l'IA a échoué.
function refund(userId, units) {
  db.prepare('UPDATE usage SET units = MAX(0, units - ?) WHERE user_id = ? AND day = ?').run(units, userId, today());
}

module.exports = { LIMIT, GLOBAL_LIMIT, COST, used, consume, refund };
