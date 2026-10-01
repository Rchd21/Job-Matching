# CV Matcher Pro

Assistant de recherche d'emploi : score de compatibilité CV / offre, CV adapté, lettre de motivation,
préparation d'entretien, estimation de salaire, offres suggérées avec alertes, comparateur, suivi des candidatures
et plan de compétences. Analyses par l'IA Claude (Anthropic).

- Design system : **UI UX Pro Max** (`design-system/cv-matcher-pro/MASTER.md`)
- Composants **21st.dev** : `src/components/ui/file-dropzone.tsx`, `src/components/ui/circular-progress.tsx`
- Composants **Magic UI** : `src/components/magicui/`

## Lancer en local

```bash
npm install
cp .env.example .env     # puis renseignez ANTHROPIC_API_KEY
npm run dev              # http://localhost:5173
```

Version de production en local :

```bash
npm run build
NODE_ENV=production PORT=3000 npm start   # http://localhost:3000
```

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clé de l'API Claude (obligatoire) | — |
| `AI_DAILY_LIMIT` | Crédits IA par utilisateur et par jour | `40` |
| `GLOBAL_DAILY_LIMIT` | Crédits IA par jour, tous utilisateurs confondus | `300` |
| `INVITE_CODE` | Code exigé à l'inscription (vide = inscriptions libres) | — |
| `DATA_DIR` | Dossier de la base SQLite | `./data` |
| `PORT` | Port en production (fourni par l'hébergeur) | `3001` |
| `API_PORT` | Port de l'API en développement | `3001` |

Coût des actions : analyse, CV adapté, lettre, entretien, salaire, plan, choix du CV = 1 crédit ; recherche d'offres = 3 crédits.

## Mise en ligne

Le serveur Node sert à la fois l'API et le site. Les données sont dans une base **SQLite** (fichier unique) :
l'hébergeur doit fournir un **disque persistant**.

### Render (recommandé)

1. Poussez le projet sur un dépôt GitHub.
2. Sur render.com : **New → Blueprint**, choisissez le dépôt (le fichier `render.yaml` configure tout : Docker, disque de 1 Go).
3. Renseignez `ANTHROPIC_API_KEY` quand Render le demande.

### Autres hébergeurs (Railway, Fly.io, VPS…)

Utilisez le `Dockerfile` fourni et montez un volume persistant sur `/data`.

### Avant d'ouvrir le site au public

- Complétez les zones `[À COMPLÉTER]` des pages **Mentions légales**, **Confidentialité** et **CGU** (`src/pages/public.tsx`).
- Ajustez `AI_DAILY_LIMIT` selon votre budget API, et fixez une limite de dépense dans la console Anthropic.
- Sauvegardez régulièrement le fichier `data/cv-matcher.db`.

## Architecture

```
server/        API Express : comptes (cookies de session), données, IA, alertes, quota
  index.js     routes
  auth.js      inscription / connexion (mots de passe chiffrés avec scrypt)
  db.js        SQLite intégré à Node (node:sqlite)
  ai.js        appels Claude : analyse, outils, recherche web d'offres
  alerts.js    recherche automatique d'offres (quotidienne ou hebdomadaire)
  offers.js    import d'une offre depuis son lien
src/           interface React + Tailwind (Vite)
  pages/       une page par section
  lib/store.tsx  données de l'utilisateur connectées à l'API
```

## Offres LinkedIn

LinkedIn bloque la récupération par lien. Installez une fois le favori « Envoyer à CV Matcher »
(menu « Bouton LinkedIn »), puis cliquez dessus depuis une offre LinkedIn.
