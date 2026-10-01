const { docs, now } = require('./db');
const { suggestOffers } = require('./ai');
const quota = require('./quota');

const PERIOD = { daily: 86400e3, weekly: 7 * 86400e3 };

function defaultCv(userId) {
  const cvs = docs.list(userId, 'cv');
  return cvs.find((c) => c.isDefault) || cvs[0] || null;
}

// Fusionne de nouvelles offres dans la liste enregistrée et marque celles qui n'y étaient pas.
function mergeSuggestions(userId, offers, criteria) {
  const previous = docs.get(userId, 'suggestions', 'latest');
  const known = new Set((previous?.offers || []).map((o) => o.url));
  const fresh = offers.map((o) => ({ ...o, isNew: !known.has(o.url) }));
  const newCount = fresh.filter((o) => o.isNew).length;
  docs.put(userId, 'suggestions', 'latest', { offers: fresh, at: now(), criteria });
  return newCount;
}

async function runAlert(userId, settings) {
  const cv = defaultCv(userId);
  if (!cv) return;
  if (quota.consume(userId, quota.COST.suggest)) return;
  const criteria = { location: settings.location || '', contract: settings.contract || '', remote: !!settings.remote };
  try {
    const offers = await suggestOffers(cv.text, criteria);
    const newCount = mergeSuggestions(userId, offers, criteria);
    docs.put(userId, 'settings', 'alerts', { ...settings, lastRunAt: now(), unseen: (settings.unseen || 0) + newCount, lastError: '' });
  } catch (err) {
    docs.put(userId, 'settings', 'alerts', { ...settings, lastRunAt: now(), lastError: err.message || 'Erreur inconnue' });
  }
}

let running = false;
async function tick() {
  if (running || !process.env.ANTHROPIC_API_KEY) return;
  running = true;
  try {
    for (const { userId, data } of docs.usersWith('settings', 'alerts')) {
      if (!data.enabled) continue;
      const last = data.lastRunAt ? Date.parse(data.lastRunAt) : 0;
      if (Date.now() - last >= (PERIOD[data.frequency] || PERIOD.weekly)) await runAlert(userId, data);
    }
  } finally {
    running = false;
  }
}

function start() {
  setTimeout(tick, 60e3).unref();
  setInterval(tick, 30 * 60e3).unref();
}

module.exports = { start, tick, mergeSuggestions, defaultCv };
