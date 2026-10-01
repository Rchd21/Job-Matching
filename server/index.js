const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const crypto = require('crypto');
const express = require('express');
const { docs, now } = require('./db');
const auth = require('./auth');
const quota = require('./quota');
const ai = require('./ai');
const alerts = require('./alerts');
const { UserError, fetchOffer } = require('./offers');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

auth.mount(app);
const { requireAuth } = auth;

const offerTitle = (text) => String(text).trim().split('\n')[0].replace(/^[-•\s]+/, '').slice(0, 140);

// Réserve le quota avant l'appel IA et le rend en cas d'échec.
function withQuota(cost, handler) {
  return async (req, res) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Aucune clé API configurée. Ajoutez ANTHROPIC_API_KEY dans le fichier .env.' });
    }
    const refused = quota.consume(req.user.id, cost);
    if (refused) return res.status(429).json({ error: refused });
    try {
      await handler(req, res);
    } catch (err) {
      quota.refund(req.user.id, cost);
      if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
      const { status, error } = ai.httpError(err);
      res.status(status).json({ error });
    }
  };
}

// ---------- Données de l'utilisateur ----------

const KINDS = new Set(['cv', 'analysis', 'application', 'compare', 'suggestions', 'settings', 'skillplan']);
const checkKind = (req, res, next) => (KINDS.has(req.params.kind) ? next() : res.status(404).json({ error: 'Type de données inconnu.' }));

app.get('/api/docs/:kind', requireAuth, checkKind, (req, res) => {
  res.json(docs.list(req.user.id, req.params.kind));
});

app.put('/api/docs/:kind/:id', requireAuth, checkKind, (req, res) => {
  const id = String(req.params.id).slice(0, 64);
  if (JSON.stringify(req.body || {}).length > 1_000_000) return res.status(413).json({ error: 'Document trop volumineux.' });
  // Un seul CV par défaut à la fois.
  if (req.params.kind === 'cv' && req.body && req.body.isDefault) {
    for (const cv of docs.list(req.user.id, 'cv')) {
      if (cv.id !== id && cv.isDefault) docs.put(req.user.id, 'cv', cv.id, { ...cv, isDefault: false });
    }
  }
  res.json(docs.put(req.user.id, req.params.kind, id, req.body || {}));
});

app.delete('/api/docs/:kind/:id', requireAuth, checkKind, (req, res) => {
  docs.remove(req.user.id, req.params.kind, String(req.params.id));
  res.json({ ok: true });
});

app.get('/api/usage', requireAuth, (req, res) => {
  res.json({ used: quota.used(req.user.id), limit: quota.LIMIT, cost: quota.COST });
});

// Export complet des données (RGPD, droit à la portabilité).
app.get('/api/export', requireAuth, (req, res) => {
  const data = { user: { email: req.user.email, name: req.user.name, createdAt: req.user.created_at }, exportedAt: now() };
  for (const kind of KINDS) data[kind] = docs.list(req.user.id, kind);
  res.setHeader('Content-Disposition', 'attachment; filename="cv-matcher-export.json"');
  res.json(data);
});

// ---------- Offres ----------

app.post('/api/fetch-offer', requireAuth, async (req, res) => {
  try {
    res.json(await fetchOffer(req.body && req.body.url));
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    if (err.name === 'TimeoutError') return res.status(504).json({ error: 'Le site met trop de temps à répondre.' });
    console.error(err);
    res.status(502).json({ error: "Impossible de récupérer cette page. Vérifiez le lien ou copiez-collez l'annonce." });
  }
});

// ---------- IA ----------

app.post('/api/analyze', requireAuth, withQuota(quota.COST.analyze, async (req, res) => {
  const { cv = '', offer = '', offerUrl = '', cvId = '', cvName = '', source = 'analyse' } = req.body || {};
  if (!cv.trim() || !offer.trim()) return res.status(400).json({ error: "Le CV et l'offre sont requis." });
  const result = await ai.analyze(cv, offer);
  const id = crypto.randomUUID();
  const doc = docs.put(req.user.id, 'analysis', id, {
    createdAt: now(), source, offerTitle: offerTitle(offer), offerUrl, offerText: offer, cvId, cvName, cvText: cv, result, tools: {}
  });
  res.json(doc);
}));

app.post('/api/analyses/:id/tools/:tool', requireAuth, withQuota(quota.COST.tool, async (req, res) => {
  const doc = docs.get(req.user.id, 'analysis', req.params.id);
  if (!doc) throw new UserError('Analyse introuvable.', 404);
  const output = await ai.runTool(req.params.tool, doc.cvText, doc.offerText);
  // Relecture après l'appel IA : d'autres outils ont pu être générés en parallèle entre-temps.
  const latest = docs.get(req.user.id, 'analysis', doc.id) || doc;
  const tools = { ...(latest.tools || {}), [req.params.tool]: { ...output, generatedAt: now() } };
  res.json(docs.put(req.user.id, 'analysis', doc.id, { ...latest, tools }));
}));

app.post('/api/skills-plan', requireAuth, withQuota(quota.COST.skills, async (req, res) => {
  const analyses = docs.list(req.user.id, 'analysis');
  if (analyses.length < 1) throw new UserError('Analysez au moins une offre pour obtenir un plan.', 400);
  const counts = new Map();
  for (const a of analyses) {
    for (const k of a.result?.missing_keywords || []) {
      const key = k.trim().toLowerCase();
      const cur = counts.get(key) || { keyword: k.trim(), count: 0 };
      cur.count += 1;
      counts.set(key, cur);
    }
  }
  const missing = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 25);
  if (!missing.length) throw new UserError('Aucune compétence manquante détectée dans vos analyses.', 400);
  const cv = alerts.defaultCv(req.user.id)?.text || analyses[0].cvText;
  const plan = await ai.skillsPlan(cv, missing);
  res.json(docs.put(req.user.id, 'skillplan', 'latest', { plan, missing, basedOn: analyses.length, generatedAt: now() }));
}));

app.post('/api/best-cv', requireAuth, withQuota(quota.COST.bestCv, async (req, res) => {
  const offer = String((req.body && req.body.offer) || '');
  const cvs = docs.list(req.user.id, 'cv').filter((c) => c.text && c.text.trim());
  if (cvs.length < 2) throw new UserError('Ajoutez au moins deux CV dans « Mes CV » pour les comparer.', 400);
  if (!offer.trim()) throw new UserError("Ajoutez d'abord le texte de l'offre.", 400);
  res.json(await ai.bestCv(cvs.map((c) => ({ id: c.id, name: c.name || 'CV', text: c.text })), offer));
}));

app.post('/api/suggest-offers', requireAuth, withQuota(quota.COST.suggest, async (req, res) => {
  const { location = '', contract = '', remote = false } = req.body || {};
  const cv = String((req.body && req.body.cv) || alerts.defaultCv(req.user.id)?.text || '');
  if (!cv.trim()) throw new UserError("Ajoutez d'abord votre CV.", 400);
  const criteria = { location: String(location).slice(0, 80), contract: String(contract).slice(0, 30), remote: !!remote };
  const offers = await ai.suggestOffers(cv, criteria);
  if (!offers.length) throw new UserError('Aucune offre vérifiée trouvée. Élargissez vos critères (ville, contrat) et réessayez.', 404);
  alerts.mergeSuggestions(req.user.id, offers, criteria);
  res.json(docs.get(req.user.id, 'suggestions', 'latest'));
}));

app.post('/api/alerts/seen', requireAuth, (req, res) => {
  const s = docs.get(req.user.id, 'settings', 'alerts');
  if (s) docs.put(req.user.id, 'settings', 'alerts', { ...s, unseen: 0 });
  const sug = docs.get(req.user.id, 'suggestions', 'latest');
  if (sug) docs.put(req.user.id, 'suggestions', 'latest', { ...sug, offers: sug.offers.map((o) => ({ ...o, isNew: false })) });
  res.json({ ok: true });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue.' }));

// ---------- Site ----------

const dist = path.join(__dirname, '..', 'dist');
app.use(express.static(dist, { index: false, maxAge: '1h' }));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));

// En production, l'hébergeur impose PORT ; en développement, l'API tourne sur API_PORT à côté de Vite.
const PORT = process.env.NODE_ENV === 'production' ? process.env.PORT || 3001 : process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`CV Matcher lancé sur http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('ANTHROPIC_API_KEY absente : copiez .env.example en .env et ajoutez votre clé.');
  alerts.start();
});
