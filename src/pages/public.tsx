import * as React from 'react'
import {
  ArrowRightIcon, BellRingIcon, BriefcaseIcon, FileTextIcon, KanbanSquareIcon, LoaderCircleIcon, MailIcon, MessagesSquareIcon, ScaleIcon, SearchIcon,
  ShieldCheckIcon, SparklesIcon, TargetIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { Notice, fieldClass } from '@/components/common'
import { ScoreGauge } from '@/components/score-gauge'
import { AnimatedThemeToggler } from '@/components/magicui/animated-theme-toggler'
import { BlurFade } from '@/components/magicui/blur-fade'
import { BorderBeam } from '@/components/magicui/border-beam'
import { DotPattern } from '@/components/magicui/dot-pattern'
import { WordRotate } from '@/components/magicui/word-rotate'
import { api, type User } from '@/lib/api'
import { navigate } from '@/lib/router'
import { store } from '@/lib/storage'
import { cn } from '@/lib/utils'

function useTheme() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
  return { theme, onThemeChange: (t: 'light' | 'dark') => { store.set('theme', t); setTheme(t) } }
}

function PublicHeader() {
  const { theme, onThemeChange } = useTheme()
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#/" aria-label="CV Matcher Pro, accueil"><Logo /></a>
        <div className="flex items-center gap-2">
          <AnimatedThemeToggler theme={theme} onThemeChange={onThemeChange} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted [&_svg]:size-[18px]" />
          <Button variant="ghost" size="sm" onClick={() => navigate('connexion')}>Se connecter</Button>
          <Button size="sm" onClick={() => navigate('inscription')}>Créer un compte</Button>
        </div>
      </div>
    </header>
  )
}

function PublicFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>© {new Date().getFullYear()} CV Matcher Pro · Analyse par Claude (Anthropic)</span>
        <nav aria-label="Informations légales" className="flex flex-wrap gap-x-5 gap-y-2">
          <a href="#/mentions-legales" className="hover:text-foreground">Mentions légales</a>
          <a href="#/confidentialite" className="hover:text-foreground">Confidentialité</a>
          <a href="#/cgu" className="hover:text-foreground">Conditions d'utilisation</a>
        </nav>
      </div>
    </footer>
  )
}

const FEATURES = [
  { icon: TargetIcon, title: 'Score de compatibilité', text: 'Un score sur 100, détaillé par catégorie, avec les mots-clés présents et manquants.' },
  { icon: FileTextIcon, title: 'CV adapté à chaque offre', text: 'Une version réécrite avec le vocabulaire de l\'offre, sans rien inventer, exportable en Word ou PDF.' },
  { icon: MailIcon, title: 'Lettre de motivation', text: 'Une lettre personnalisée à partir de vos réalisations réelles, prête à relire et envoyer.' },
  { icon: MessagesSquareIcon, title: 'Préparation d\'entretien', text: 'Les questions probables pour le poste et comment y répondre avec votre parcours.' },
  { icon: SearchIcon, title: 'Offres pour vous', text: 'Des offres ouvertes qui correspondent à votre profil, et des alertes quand de nouvelles apparaissent.' },
  { icon: KanbanSquareIcon, title: 'Suivi des candidatures', text: 'Un tableau de bord de vos candidatures avec rappels de relance.' },
  { icon: ScaleIcon, title: 'Comparateur d\'offres', text: 'Jusqu\'à 5 offres classées par compatibilité pour savoir où postuler en priorité.' },
  { icon: SparklesIcon, title: 'Plan de compétences', text: 'Les compétences qui vous manquent le plus souvent, et comment les acquérir.' },
]

export function LandingPage() {
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main>
        <section className="relative overflow-hidden border-b">
          <DotPattern width={24} height={24} cr={1.1} className="text-border-strong [mask-image:radial-gradient(ellipse_at_top,white_30%,transparent_75%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
            <BlurFade>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-xs">
                <SparklesIcon className="size-3.5 text-primary" aria-hidden="true" /> Assistant de recherche d'emploi propulsé par l'IA
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                Décrochez plus d'entretiens avec un CV taillé pour{' '}
                <WordRotate words={['chaque offre.', 'chaque recruteur.', 'les logiciels ATS.']} duration={2600} className="text-primary" />
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                CV Matcher Pro compare votre CV à une offre, vous dit précisément quoi améliorer, rédige votre CV adapté et votre lettre, puis suit vos candidatures.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => navigate('inscription')}>Commencer gratuitement <ArrowRightIcon aria-hidden="true" /></Button>
                <Button size="lg" variant="outline" onClick={() => navigate('connexion')}>J'ai déjà un compte</Button>
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheckIcon className="size-4 text-success" aria-hidden="true" /> Vos données restent privées et supprimables à tout moment.
              </p>
            </BlurFade>

            <BlurFade delay={0.15} className="relative rounded-2xl border bg-card p-5 shadow-lg">
              <BorderBeam size={120} duration={9} borderWidth={1.5} colorFrom="#22c55e" colorTo="#2563eb" />
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Rapport de compatibilité</p>
                  <p className="font-semibold">Développeur Frontend React · In Extenso</p>
                </div>
                <BriefcaseIcon className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="mt-4 grid items-center gap-5 sm:grid-cols-[auto_1fr]">
                <div className="flex justify-center"><ScoreGauge score={76} size={130} /></div>
                <ul className="space-y-2.5 text-sm">
                  {[['Compétences techniques', 85], ['Expérience', 75], ['Formation', 75], ['Soft skills', 58], ['Langues', 75]].map(([k, v]) => (
                    <li key={k as string}>
                      <div className="mb-1 flex justify-between"><span>{k}</span><span className="font-semibold tabular-nums">{v}</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn('h-full rounded-full', (v as number) >= 75 ? 'bg-success' : 'bg-warning')} style={{ width: `${v}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {['Kanban', 'Product Owner', 'Agile', 'TypeScript'].map((k) => (
                  <span key={k} className="rounded-md border border-dashed border-destructive/40 bg-destructive-soft px-2 py-1 text-xs font-semibold text-destructive">+ {k}</span>
                ))}
              </div>
            </BlurFade>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="features-title">
          <h2 id="features-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Tout pour votre recherche d'emploi, au même endroit</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">De l'analyse de l'offre jusqu'à la négociation du salaire.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <li key={f.title}>
                <BlurFade delay={0.04 * i} inView className="h-full rounded-xl border bg-card p-5 shadow-xs">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft">
                    <f.icon className="size-5 text-primary" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                </BlurFade>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y bg-card" aria-labelledby="how-title">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="how-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Comment ça marche</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                ['Ajoutez votre CV', 'Importez un PDF ou collez le texte. Vous pouvez garder plusieurs versions.'],
                ['Choisissez une offre', 'Collez un lien Indeed, Welcome to the Jungle, France Travail… ou utilisez le bouton LinkedIn.'],
                ['Postulez mieux', 'Suivez les recommandations, générez CV et lettre, puis suivez la candidature.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                  <div>
                    <h3 className="font-semibold">{t}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <BellRingIcon className="mx-auto size-8 text-primary" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Prêt à décrocher votre prochain poste ?</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">Créez votre compte en 30 secondes et lancez votre première analyse.</p>
          <Button size="lg" className="mt-6" onClick={() => navigate('inscription')}>Créer mon compte <ArrowRightIcon aria-hidden="true" /></Button>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}

export function AuthPage({ mode, onAuth }: { mode: 'connexion' | 'inscription'; onAuth: (u: User) => void }) {
  const signup = mode === 'inscription'
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [consent, setConsent] = React.useState(false)
  const [invite, setInvite] = React.useState('')
  const [inviteRequired, setInviteRequired] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (signup) api.authConfig().then((c) => setInviteRequired(c.inviteRequired)).catch(() => {})
  }, [signup])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (signup && !consent) { setError("Acceptez les conditions d'utilisation pour créer votre compte."); return }
    setBusy(true)
    try {
      const { user } = signup ? await api.signup({ name, email, password, invite }) : await api.login({ email, password })
      onAuth(user)
      navigate('tableau-de-bord')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
        <DotPattern width={22} height={22} cr={1} className="text-border-strong [mask-image:radial-gradient(ellipse_at_center,white_10%,transparent_65%)]" />
        <BlurFade className="relative w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lg sm:p-8">
          <h1 className="text-xl font-bold tracking-tight">{signup ? 'Créer votre compte' : 'Bon retour parmi nous'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {signup ? 'Gratuit, sans carte bancaire.' : 'Connectez-vous pour retrouver vos analyses.'}
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {signup && (
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium">Prénom</label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required className={cn(fieldClass, 'h-10 px-3')} />
              </div>
            )}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">E-mail</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={cn(fieldClass, 'h-10 px-3')} />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Mot de passe</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} required aria-describedby={signup ? 'pw-help' : undefined} className={cn(fieldClass, 'h-10 px-3')} />
              {signup && <p id="pw-help" className="mt-1.5 text-xs text-muted-foreground">8 caractères minimum.</p>}
            </div>
            {signup && inviteRequired && (
              <div>
                <label htmlFor="invite" className="mb-1.5 block text-sm font-medium">Code d'invitation</label>
                <input id="invite" value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="off" required aria-describedby="invite-help" className={cn(fieldClass, 'h-10 px-3')} />
                <p id="invite-help" className="mt-1.5 text-xs text-muted-foreground">L'accès est pour l'instant sur invitation.</p>
              </div>
            )}
            {signup && (
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                <span className="text-muted-foreground">
                  J'accepte les <a href="#/cgu" className="font-medium text-primary hover:underline">conditions d'utilisation</a> et la{' '}
                  <a href="#/confidentialite" className="font-medium text-primary hover:underline">politique de confidentialité</a>.
                </span>
              </label>
            )}
            {error && <Notice error={error} />}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
              {signup ? 'Créer mon compte' : 'Se connecter'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {signup ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
            <a href={signup ? '#/connexion' : '#/inscription'} className="font-semibold text-primary hover:underline">
              {signup ? 'Se connecter' : 'Créer un compte'}
            </a>
          </p>
        </BlurFade>
      </main>
      <PublicFooter />
    </div>
  )
}

// Pages légales : modèles à compléter avec les informations de l'éditeur avant la mise en ligne publique.
const TODO = (s: string) => <mark className="rounded bg-warning-soft px-1 text-warning">[{s}]</mark>

const LEGAL: Record<string, { title: string; body: React.ReactNode }> = {
  'mentions-legales': {
    title: 'Mentions légales',
    body: (
      <>
        <h2>Éditeur du site</h2>
        <p>{TODO('Nom et prénom ou raison sociale')}<br />{TODO('Adresse postale')}<br />E-mail : {TODO('adresse de contact')}<br />{TODO('SIRET, si activité professionnelle')}</p>
        <p>Directeur de la publication : {TODO('Nom et prénom')}</p>
        <h2>Hébergement</h2>
        <p>{TODO("Nom de l'hébergeur, adresse et téléphone")}</p>
        <h2>Intelligence artificielle</h2>
        <p>Les analyses, CV adaptés, lettres et recommandations sont générés par le modèle Claude d'Anthropic PBC. Ils sont fournis à titre indicatif et doivent être relus avant tout usage.</p>
        <h2>Propriété intellectuelle</h2>
        <p>Les contenus que vous importez (CV, offres) restent votre propriété. Le code et le design du site sont la propriété de l'éditeur.</p>
      </>
    ),
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    body: (
      <>
        <p>Cette politique explique quelles données sont traitées, pourquoi, et quels sont vos droits au titre du RGPD.</p>
        <h2>Responsable du traitement</h2>
        <p>{TODO('Nom et coordonnées du responsable')} — contact : {TODO('adresse e-mail')}</p>
        <h2>Données traitées</h2>
        <ul>
          <li>Compte : prénom, adresse e-mail, mot de passe (stocké uniquement sous forme chiffrée irréversible).</li>
          <li>Contenus : CV, offres d'emploi, analyses, lettres, candidatures et notes que vous enregistrez.</li>
          <li>Technique : un cookie de session strictement nécessaire à la connexion. Aucun cookie publicitaire ni de mesure d'audience.</li>
        </ul>
        <h2>Finalités et base légale</h2>
        <p>Fournir le service que vous demandez (exécution du contrat) : analyser vos candidatures, générer des documents et suivre vos démarches.</p>
        <h2>Sous-traitants</h2>
        <p>
          Le texte de votre CV et des offres est transmis à Anthropic PBC (États-Unis) pour générer les analyses, dans le cadre de son API commerciale ;
          ces données ne servent pas à entraîner ses modèles. Hébergement : {TODO('hébergeur et pays')}.
        </p>
        <h2>Durée de conservation</h2>
        <p>Vos données sont conservées tant que votre compte existe, et supprimées définitivement lorsque vous le supprimez.</p>
        <h2>Vos droits</h2>
        <p>
          Accès, rectification, effacement, portabilité et opposition. Depuis <strong>Paramètres</strong>, vous pouvez exporter toutes vos données et supprimer votre compte.
          Vous pouvez aussi écrire à {TODO('adresse e-mail')} et saisir la CNIL (cnil.fr) en cas de litige.
        </p>
      </>
    ),
  },
  cgu: {
    title: "Conditions d'utilisation",
    body: (
      <>
        <h2>Objet</h2>
        <p>CV Matcher Pro aide à analyser la compatibilité entre un CV et une offre d'emploi et à préparer ses candidatures.</p>
        <h2>Compte</h2>
        <p>Vous êtes responsable de la confidentialité de votre mot de passe et des contenus que vous importez. N'importez que des documents qui vous appartiennent.</p>
        <h2>Contenus générés par l'IA</h2>
        <p>Les résultats sont indicatifs et peuvent comporter des erreurs. Relisez-les avant de les utiliser. Le site ne garantit ni l'obtention d'un entretien ni celle d'un emploi.</p>
        <h2>Utilisation équitable</h2>
        <p>Un nombre de crédits IA quotidien limite l'usage de chaque compte. Toute utilisation abusive ou automatisée peut entraîner la suspension du compte.</p>
        <h2>Offres d'emploi tierces</h2>
        <p>Les offres proposées proviennent de sites tiers ; leur exactitude et leur disponibilité relèvent de ces sites.</p>
        <h2>Contact</h2>
        <p>{TODO('adresse e-mail de contact')}</p>
      </>
    ),
  },
}

export function LegalPage({ slug }: { slug: string }) {
  const page = LEGAL[slug] || LEGAL['mentions-legales']
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
        <div className="mt-8 space-y-4 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_ul]:space-y-1.5 [&_ul]:text-muted-foreground">
          {page.body}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
