const cheerio = require('cheerio');
const dns = require('dns').promises;
const net = require('net');

class UserError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

const BLOCKED_MSG = 'Ce site bloque la récupération automatique. Utilisez le bouton « Envoyer à CV Matcher » ou copiez-collez l\'annonce.';

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
    return v === '::1' || v === '::' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

async function assertPublicUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new UserError('Lien invalide.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new UserError('Le lien doit commencer par http:// ou https://.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host)
    ? [{ address: host }]
    : await dns.lookup(host, { all: true }).catch(() => { throw new UserError('Site introuvable, vérifiez le lien.'); });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new UserError('Ce lien pointe vers une adresse locale non autorisée.');
  return url;
}

const isLinkedIn = (url) => /(^|\.)linkedin\.com$/i.test(url.hostname);

async function fetchPage(raw) {
  let url = await assertPublicUrl(raw);
  for (let i = 0; i < 5; i++) {
    if (isLinkedIn(url)) {
      throw new UserError('LinkedIn bloque la récupération automatique. Utilisez le bouton « Envoyer à CV Matcher » depuis la page de l\'offre.');
    }
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      }
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = await assertPublicUrl(new URL(location, url).href);
      continue;
    }
    if ([401, 403, 429, 999].includes(res.status)) throw new UserError(BLOCKED_MSG);
    if ([404, 410].includes(res.status)) throw new UserError("Cette offre n'est plus en ligne (expirée ou retirée).");
    if (!res.ok) throw new UserError(`La page a répondu avec une erreur (${res.status}).`);
    if (!(res.headers.get('content-type') || '').includes('html')) throw new UserError('Ce lien ne mène pas à une page web.');
    return { html: await res.text(), url };
  }
  throw new UserError('Trop de redirections.');
}

function cleanText(t) {
  return t.replace(/ /g, ' ')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToText($, root) {
  root.find('br').replaceWith('\n');
  root.find('li').prepend('- ');
  root.find('p,li,h1,h2,h3,h4,h5,h6,div,section,article,tr,ul,ol').append('\n');
  return cleanText(root.text());
}

function extractOffer(html) {
  const $ = cheerio.load(html);

  for (const script of $('script[type="application/ld+json"]').toArray()) {
    let data;
    try { data = JSON.parse($(script).text()); } catch { continue; }
    const items = [].concat(data).flatMap((d) => (d && d['@graph'] ? d['@graph'] : [d]));
    const job = items.find((d) => d && [].concat(d['@type']).includes('JobPosting'));
    if (!job || !job.description) continue;

    let desc = String(job.description);
    if (!/<[a-z]/i.test(desc) && /&lt;/.test(desc)) desc = cheerio.load(`<div>${desc}</div>`)('div').text();
    const $d = cheerio.load(`<div id="offer-root">${desc}</div>`);
    const org = job.hiringOrganization;
    const location = [].concat(job.jobLocation || [])
      .map((l) => l && l.address && l.address.addressLocality)
      .filter(Boolean).join(', ');
    return {
      title: job.title || '',
      company: typeof org === 'string' ? org : (org && org.name) || '',
      location,
      text: htmlToText($d, $d('#offer-root'))
    };
  }

  $('script,style,noscript,svg,nav,header,footer,form,iframe,button,aside').remove();
  const root = ['main', 'article', '[role="main"]']
    .map((s) => $(s).first())
    .find((n) => n.length && n.text().trim().length > 200) || $('body');
  return {
    title: cleanText($('h1').first().text()) || cleanText($('title').text()),
    company: '',
    location: '',
    text: htmlToText($, root)
  };
}


// Récupère une offre à partir de son lien et la met en forme (titre, entreprise, source, texte).
async function fetchOffer(rawUrl) {
  const { html, url } = await fetchPage(String(rawUrl || '').trim());
  const offer = extractOffer(html);
  if (offer.text.length < 200) {
    throw new UserError("Impossible de trouver le texte de l'offre sur cette page. Utilisez le bouton « Envoyer à CV Matcher » ou copiez-collez l'annonce.");
  }
  const header = [offer.title, [offer.company, offer.location].filter(Boolean).join(' · '), `Source : ${url.href}`].filter(Boolean).join('\n');
  return { title: offer.title, company: offer.company, host: url.hostname, url: url.href, text: `${header}\n\n${offer.text}` };
}

// Écarte les offres expirées (404/410). Les sites qui bloquent les robots (403, 999…) sont gardés : l'offre existe.
async function isStillOnline(rawUrl) {
  try {
    const url = await assertPublicUrl(rawUrl);
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' }
    });
    res.body?.cancel();
    return ![404, 410].includes(res.status);
  } catch {
    return true;
  }
}

module.exports = { UserError, fetchOffer, isStillOnline };
