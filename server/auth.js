const crypto = require('crypto');
const { db, now } = require('./db');

const SESSION_DAYS = 30;
const COOKIE = 'sid';
const isProd = process.env.NODE_ENV === 'production';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = String(stored).split('$');
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((c) => c.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))])
  );
}

const clearCookie = (res) => res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sha256(token), userId, Date.now() + SESSION_DAYS * 86400e3);
  const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_DAYS * 86400}`];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, createdAt: u.created_at });

function currentUser(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  return db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha256(token), Date.now()) || null;
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Votre session a expiré. Reconnectez-vous.' });
  req.user = user;
  next();
}

// Limite simple des tentatives de connexion par adresse IP.
const attempts = new Map();
function tooManyAttempts(ip) {
  const a = attempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60e3) { a.n = 0; a.t = Date.now(); }
  a.n += 1;
  attempts.set(ip, a);
  return a.n > 20;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mount(app) {
  app.post('/api/auth/signup', (req, res) => {
    const { email = '', password = '', name = '' } = req.body || {};
    const mail = String(email).trim().toLowerCase();
    if (tooManyAttempts(req.ip)) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
    if (!EMAIL_RE.test(mail)) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    if (!String(name).trim()) return res.status(400).json({ error: 'Indiquez votre prénom.' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(mail)) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse. Connectez-vous.' });
    }
    const user = { id: crypto.randomUUID(), email: mail, name: String(name).trim().slice(0, 60), created_at: now() };
    db.prepare('INSERT INTO users (id, email, name, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(user.id, user.email, user.name, hashPassword(String(password)), user.created_at);
    createSession(res, user.id);
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email = '', password = '' } = req.body || {};
    if (tooManyAttempts(req.ip)) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
    if (!user || !verifyPassword(String(password), user.pass_hash)) {
      return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
    }
    createSession(res, user.id);
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    clearCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = currentUser(req);
    res.json({ user: user ? publicUser(user) : null });
  });

  app.patch('/api/auth/me', requireAuth, (req, res) => {
    const name = String((req.body && req.body.name) || '').trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Indiquez votre prénom.' });
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
    res.json({ user: publicUser({ ...req.user, name }) });
  });

  // Suppression du compte et de toutes ses données (droit à l'effacement, RGPD).
  app.delete('/api/auth/account', requireAuth, (req, res) => {
    const { password = '' } = req.body || {};
    if (!verifyPassword(String(password), req.user.pass_hash)) return res.status(401).json({ error: 'Mot de passe incorrect.' });
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    clearCookie(res);
    res.json({ ok: true });
  });

  setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 3600e3).unref();
}

module.exports = { mount, requireAuth };
