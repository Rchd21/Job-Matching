const Anthropic = require('@anthropic-ai/sdk').default;
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
const { z } = require('zod');
const { isStillOnline } = require('./offers');

const client = new Anthropic();
const MODEL = 'claude-opus-5';

class AiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const NO_INVENTION = "Ne jamais inventer d'expérience, de diplôme, de compétence ni de chiffre absents du CV : reformuler, réorganiser et mettre en valeur uniquement ce qui existe.";

async function parse(schema, { system, content, effort = 'medium', maxTokens = 16000 }) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
    output_config: { effort, format: zodOutputFormat(schema) }
  });
  if (response.stop_reason === 'refusal') throw new AiError('La demande a été refusée par le modèle.', 422);
  if (!response.parsed_output) throw new AiError('Réponse inattendue du modèle, réessayez.');
  return response.parsed_output;
}

const cvOffer = (cv, offer) => `<cv>\n${cv}\n</cv>\n\n<offre>\n${offer}\n</offre>`;

// ---------- Analyse de compatibilité ----------

const AnalysisSchema = z.object({
  score: z.number(),
  summary: z.string(),
  breakdown: z.array(z.object({ category: z.string(), score: z.number() })),
  matched_keywords: z.array(z.string()),
  missing_keywords: z.array(z.string()),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  priority_actions: z.array(z.string()),
  recommendations: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    example: z.string(),
    impact: z.enum(['high', 'medium', 'low'])
  }))
});

const ANALYZE_SYSTEM = `Tu es un recruteur expert et un spécialiste des systèmes ATS. Tu compares un CV à une offre d'emploi et tu réponds en français.

- score : compatibilité globale 0-100, honnête et calibrée (90+ = quasi parfait, 50 = environ la moitié des exigences couvertes).
- summary : 2-3 phrases de synthèse destinées au candidat.
- breakdown : exactement ces 5 catégories, dans cet ordre, chacune notée 0-100 : "Compétences techniques", "Expérience", "Formation", "Soft skills", "Langues". Si l'offre n'exige rien pour une catégorie, note selon l'adéquation générale.
- matched_keywords : mots-clés importants de l'offre (outils, technos, méthodes, diplômes, intitulés) présents dans le CV, formulés courts (1-3 mots).
- missing_keywords : mots-clés importants de l'offre absents du CV, formulés courts.
- strengths : 3-5 points forts du CV pour cette offre.
- gaps : 3-5 écarts entre le CV et l'offre.
- priority_actions : les 3 actions les plus impactantes, une phrase courte chacune.
- recommendations : 5-8 modifications concrètes du CV, triées par impact décroissant. title = action courte ; detail = pourquoi et comment ; example = une formulation prête à copier dans le CV (ligne de compétence, puce d'expérience, accroche), ou "" si non pertinent ; impact = high, medium ou low.

Ne suggère jamais d'inventer une expérience ou une compétence : propose de mettre en valeur ce qui existe déjà, de reformuler avec le vocabulaire de l'offre, ou d'acquérir la compétence si elle manque vraiment.`;

async function analyze(cv, offer) {
  const out = await parse(AnalysisSchema, { system: ANALYZE_SYSTEM, content: cvOffer(cv, offer), effort: 'high' });
  return { ...out, score: Math.max(0, Math.min(100, Math.round(out.score))) };
}

// ---------- Outils générés à partir d'une analyse ----------

const TOOLS = {
  tailor: {
    schema: z.object({
      cv: z.string(),
      changes: z.array(z.object({ section: z.string(), change: z.string(), reason: z.string() }))
    }),
    effort: 'high',
    system: `Tu es un expert en rédaction de CV et en optimisation ATS. Tu réécris le CV du candidat pour l'adapter à l'offre, en français.

- cv : le CV complet réécrit, en texte brut structuré (titres de sections en MAJUSCULES, puces "- "), prêt à être copié. Garde toutes les informations factuelles (dates, employeurs, diplômes, coordonnées).
- Reprends le vocabulaire exact de l'offre quand il correspond à une réalité du CV, réordonne les compétences et expériences pour mettre en avant les plus pertinentes, et écris une accroche ciblée.
- changes : la liste des modifications effectuées (section concernée, ce qui a changé, pourquoi), 4 à 10 éléments.
- ${NO_INVENTION}`
  },
  letter: {
    schema: z.object({ subject: z.string(), body: z.string() }),
    effort: 'high',
    system: `Tu rédiges une lettre de motivation en français pour l'offre, à partir du CV du candidat.

- subject : l'objet de la lettre (ex. « Candidature au poste de … »).
- body : la lettre complète, 250 à 350 mots, avec formule d'appel, 3 paragraphes (vous / moi / nous) et formule de politesse, signée avec le nom du candidat s'il figure dans le CV. Ton professionnel, direct et sincère, sans formules creuses.
- Cite 2 ou 3 réalisations concrètes du CV reliées aux besoins de l'offre.
- ${NO_INVENTION}`
  },
  interview: {
    schema: z.object({
      questions: z.array(z.object({
        category: z.enum(['Motivation', 'Technique', 'Expérience', 'Comportement', 'Point faible']),
        question: z.string(),
        why: z.string(),
        tips: z.string()
      }))
    }),
    effort: 'medium',
    system: `Tu prépares le candidat à un entretien d'embauche pour cette offre, en français.

- questions : 8 à 10 questions probables, dont au moins 2 qui ciblent les écarts entre le CV et l'offre (catégorie « Point faible »).
- why : pourquoi le recruteur pose cette question, en une phrase.
- tips : comment y répondre, en s'appuyant sur des éléments réels du CV (méthode STAR pour les questions comportementales). ${NO_INVENTION}`
  },
  salary: {
    schema: z.object({
      low: z.number(),
      median: z.number(),
      high: z.number(),
      basis: z.string(),
      rationale: z.string(),
      tips: z.array(z.string())
    }),
    effort: 'medium',
    system: `Tu estimes la rémunération du poste de l'offre pour ce candidat, sur le marché français, en français.

- low, median, high : salaire brut annuel en euros (nombres entiers), fourchette réaliste pour ce poste, ce niveau d'expérience et cette ville. Si l'offre affiche un salaire, pars de celui-ci.
- basis : ce sur quoi repose l'estimation (poste, séniorité, ville, taille d'entreprise), en une phrase.
- rationale : 2-3 phrases expliquant la fourchette et où le candidat se situe.
- tips : 3 à 5 conseils concrets de négociation adaptés au profil.
Reste prudent : c'est une estimation indicative, pas une donnée officielle.`
  }
};

async function runTool(tool, cv, offer) {
  const t = TOOLS[tool];
  if (!t) throw new AiError('Outil inconnu.', 400);
  return parse(t.schema, { system: t.system, content: cvOffer(cv, offer), effort: t.effort });
}

// ---------- Plan de montée en compétences ----------

const SkillsSchema = z.object({
  summary: z.string(),
  skills: z.array(z.object({
    name: z.string(),
    priority: z.enum(['haute', 'moyenne', 'basse']),
    why: z.string(),
    duration: z.string(),
    steps: z.array(z.string()),
    resources: z.array(z.object({ title: z.string(), type: z.enum(['Documentation', 'Cours', 'Projet', 'Certification', 'Livre', 'Vidéo']) }))
  }))
});

async function skillsPlan(cv, missing) {
  const list = missing.map((m) => `- ${m.keyword} (demandé dans ${m.count} offre${m.count > 1 ? 's' : ''})`).join('\n');
  return parse(SkillsSchema, {
    effort: 'medium',
    system: `Tu es un coach carrière. À partir du CV et des compétences qui manquent le plus souvent dans les offres visées, tu construis un plan de montée en compétences réaliste, en français.

- summary : 2 phrases sur la stratégie globale.
- skills : 4 à 6 compétences à travailler en priorité (regroupe les mots-clés proches, ignore les termes non apprenables comme une ville ou un type de contrat).
- duration : temps estimé pour atteindre un niveau présentable en entretien (ex. « 2 à 3 semaines, 5 h/semaine »).
- steps : 3 à 4 étapes concrètes, dont un mini-projet à mettre sur le CV ou GitHub.
- resources : 2 à 4 ressources reconnues, désignées par leur nom exact (ex. « Documentation officielle TypeScript », « Cours Docker d'OpenClassrooms »). Ne donne pas d'URL.`,
    content: `<cv>\n${cv}\n</cv>\n\n<competences_manquantes>\n${list}\n</competences_manquantes>`
  });
}

// ---------- Choix du meilleur CV pour une offre ----------

const BestCvSchema = z.object({
  ranking: z.array(z.object({ cv_id: z.string(), score: z.number(), reason: z.string() }))
});

async function bestCv(cvs, offer) {
  const blocks = cvs.map((c) => `<cv id="${c.id}" nom="${c.name.replace(/"/g, "'")}">\n${c.text}\n</cv>`).join('\n\n');
  const out = await parse(BestCvSchema, {
    effort: 'low',
    system: `Tu compares plusieurs versions du CV d'un même candidat pour une offre et tu indiques laquelle envoyer, en français.
- ranking : tous les CV, du plus adapté au moins adapté. cv_id = l'attribut id du CV ; score = compatibilité estimée 0-100 ; reason = une phrase.`,
    content: `${blocks}\n\n<offre>\n${offer}\n</offre>`
  });
  const ids = new Set(cvs.map((c) => c.id));
  return { ranking: out.ranking.filter((r) => ids.has(r.cv_id)).map((r) => ({ ...r, score: Math.max(0, Math.min(100, Math.round(r.score))) })) };
}

// ---------- Recherche d'offres sur le web ----------

const SUGGEST_SYSTEM = `Tu es un chasseur d'emploi pour le marché français. À partir d'un CV et des critères du candidat, tu cherches sur le web des offres d'emploi actuellement ouvertes qui lui correspondent, puis tu les transmets avec l'outil submit_offers.

- Fais plusieurs recherches ciblées (intitulés de poste proches du profil, compétences clés, ville), en privilégiant les pages d'offre individuelles sur welcometothejungle.com, fr.indeed.com, francetravail.fr, apec.fr, hellowork.com et linkedin.com/jobs/view.
- N'inclus que des offres dont tu as vu l'URL exacte dans les résultats de recherche. N'invente jamais d'URL ni d'entreprise. Écarte les pages de liste ou de recherche, et les offres visiblement expirées.
- Retiens 6 à 10 offres, triées de la plus pertinente à la moins pertinente.
- match_score : estimation 0-100 de l'adéquation au CV, honnête et calibrée.
- why : une phrase en français expliquant pourquoi l'offre correspond (ou ce qui manque).
- Termine toujours en appelant submit_offers, même si tu trouves peu d'offres.`;

const SUBMIT_OFFERS_TOOL = {
  name: 'submit_offers',
  description: 'Transmet la liste finale des offres trouvées, triées par pertinence.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['offers'],
    properties: {
      offers: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'company', 'location', 'contract', 'url', 'match_score', 'why'],
          properties: {
            title: { type: 'string' },
            company: { type: 'string' },
            location: { type: 'string' },
            contract: { type: 'string', description: 'CDI, CDD, alternance, stage, freelance… ou "" si inconnu' },
            url: { type: 'string' },
            match_score: { type: 'integer' },
            why: { type: 'string' }
          }
        }
      }
    }
  }
};

const normUrl = (u) => {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase();
  } catch {
    return '';
  }
};

async function suggestOffers(cv, { location = '', contract = '', remote = false } = {}) {
  const prefs = [
    location && `Lieu souhaité : ${location}`,
    contract && `Type de contrat : ${contract}`,
    remote && 'Télétravail souhaité (total ou partiel)'
  ].filter(Boolean).join('\n') || 'Aucun critère particulier.';

  const messages = [{
    role: 'user',
    content: `<cv>\n${cv}\n</cv>\n\n<criteres>\n${prefs}\n</criteres>\n\nTrouve des offres d'emploi ouvertes qui correspondent à ce profil.`
  }];
  const seenUrls = new Set();
  const verified = new Map();
  let retries = 0;
  const finish = () => [...verified.values()]
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 10);

  for (let turn = 0; turn < 8; turn++) {
    const response = await client.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      system: SUGGEST_SYSTEM,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8, user_location: { type: 'approximate', country: 'FR' } }, SUBMIT_OFFERS_TOOL],
      messages
    }).finalMessage();

    for (const block of response.content) {
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) if (r.url) seenUrls.add(normUrl(r.url));
      }
    }
    if (response.stop_reason === 'refusal') throw new AiError('La recherche a été refusée par le modèle.', 422);
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }

    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === 'submit_offers');
    if (!submit) {
      if (verified.size) return finish();
      throw new AiError("Aucune offre n'a été renvoyée, réessayez.");
    }

    // Ne garde que les offres dont l'URL a été vue dans les résultats de recherche et qui sont encore en ligne.
    const submitted = submit.input.offers || [];
    const candidates = submitted.filter((o) => seenUrls.has(normUrl(o.url)) && !verified.has(normUrl(o.url)));
    const alive = await Promise.all(candidates.map((o) => isStillOnline(o.url)));
    candidates.forEach((o, i) => {
      if (alive[i]) verified.set(normUrl(o.url), { ...o, match_score: Math.max(0, Math.min(100, Math.round(o.match_score))) });
    });

    // Trop peu d'offres valides : on demande à Claude de compléter (2 relances au maximum).
    if (verified.size >= 4 || retries >= 2) return finish();
    retries += 1;
    const rejected = submitted.length - candidates.filter((_, i) => alive[i]).length;
    messages.push({ role: 'assistant', content: response.content });
    messages.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: submit.id,
        content: `Seules ${verified.size} offre(s) ont été validées : ${rejected} ont été écartées (URL absente des résultats de recherche, page de liste, ou annonce expirée). Fais de nouvelles recherches ciblées pour trouver d'autres offres individuelles encore ouvertes, puis rappelle submit_offers avec uniquement les nouvelles offres.`
      }]
    });
  }
  if (verified.size) return finish();
  throw new AiError('La recherche a pris trop de temps, réessayez.', 504);
}

// Traduit les erreurs de l'API en messages clairs pour l'interface.
function httpError(err) {
  if (err instanceof AiError) return { status: err.status, error: err.message };
  if (err instanceof Anthropic.AuthenticationError) return { status: 500, error: 'Clé API invalide. Vérifiez ANTHROPIC_API_KEY dans le fichier .env.' };
  if (err instanceof Anthropic.RateLimitError) return { status: 429, error: 'Trop de requêtes, réessayez dans un instant.' };
  if (err instanceof Anthropic.APIConnectionError) return { status: 502, error: "Impossible de joindre l'API Claude. Vérifiez votre connexion." };
  if (!process.env.ANTHROPIC_API_KEY) return { status: 500, error: 'Aucune clé API configurée. Ajoutez ANTHROPIC_API_KEY dans le fichier .env.' };
  console.error(err);
  return { status: 500, error: 'Une erreur est survenue, réessayez.' };
}

module.exports = { analyze, runTool, skillsPlan, bestCv, suggestOffers, httpError, normUrl };
