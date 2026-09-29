import * as React from 'react'
import {
  BookmarkPlusIcon, FileTextIcon, GraduationCapIcon, HistoryIcon, KanbanSquareIcon, LayoutDashboardIcon, LoaderCircleIcon, LogOutIcon, MenuIcon, ScaleIcon, SearchIcon,
  SettingsIcon, SparklesIcon, XIcon,
} from 'lucide-react'
import { MotionConfig } from 'motion/react'
import { AnimatedThemeToggler } from '@/components/magicui/animated-theme-toggler'
import { BookmarkletDialog } from '@/components/bookmarklet-dialog'
import { Logo } from '@/components/logo'
import { ToastProvider } from '@/components/toast'
import { Button } from '@/components/ui/button'
import { ResultsView } from '@/components/results-view'
import { AuthPage, LandingPage, LegalPage } from '@/pages/public'
import { DashboardPage } from '@/pages/dashboard'
import { SinglePage, type IncomingOffer } from '@/pages/single'
import { ComparePage, MAX_COMPARE, newCompareItem } from '@/pages/compare'
import { SuggestPage } from '@/pages/suggest'
import { ApplicationsPage, needsFollowUp } from '@/pages/applications'
import { HistoryPage } from '@/pages/history'
import { CvsPage } from '@/pages/cvs'
import { SkillsPage } from '@/pages/skills'
import { SettingsPage } from '@/pages/settings'
import { api, type SuggestedOffer, type User } from '@/lib/api'
import { takeImportedOffer } from '@/lib/bookmarklet'
import { DataProvider, useData } from '@/lib/store'
import { navigate, useRoute } from '@/lib/router'
import { store } from '@/lib/storage'
import { isLinkedIn } from '@/lib/text'
import { cn } from '@/lib/utils'

const LINKEDIN_HINT = "LinkedIn bloque l'import automatique : l'offre s'ouvre dans un nouvel onglet, cliquez ensuite sur votre favori « Envoyer à CV Matcher »."
const PUBLIC = new Set(['', 'connexion', 'inscription', 'mentions-legales', 'confidentialite', 'cgu'])

interface NavItem { path: string; label: string; short: string; icon: React.ElementType }
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Espace de travail',
    items: [
      { path: 'tableau-de-bord', label: 'Tableau de bord', short: 'Accueil', icon: LayoutDashboardIcon },
      { path: 'analyser', label: 'Analyser une offre', short: 'Analyser', icon: SparklesIcon },
      { path: 'comparer', label: 'Comparer', short: 'Comparer', icon: ScaleIcon },
      { path: 'offres', label: 'Offres pour moi', short: 'Offres', icon: SearchIcon },
    ],
  },
  {
    title: 'Suivi',
    items: [
      { path: 'candidatures', label: 'Candidatures', short: 'Suivi', icon: KanbanSquareIcon },
      { path: 'historique', label: 'Historique', short: 'Historique', icon: HistoryIcon },
      { path: 'competences', label: 'Compétences', short: 'Compétences', icon: GraduationCapIcon },
    ],
  },
  {
    title: 'Profil',
    items: [
      { path: 'cv', label: 'Mes CV', short: 'CV', icon: FileTextIcon },
      { path: 'parametres', label: 'Paramètres', short: 'Réglages', icon: SettingsIcon },
    ],
  },
]
const MOBILE_NAV = ['tableau-de-bord', 'analyser', 'offres', 'candidatures']
const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

function useTheme() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
  return { theme, onThemeChange: (t: 'light' | 'dark') => { store.set('theme', t); setTheme(t) } }
}

function NavLink({ item, active, badge, mobile, onClick }: { item: NavItem; active: boolean; badge?: number; mobile?: boolean; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <a
      href={`#/${item.path}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center transition-colors duration-150',
        mobile
          ? cn('flex-1 flex-col justify-center gap-1 text-[11px] font-semibold', active ? 'text-primary' : 'text-muted-foreground')
          : cn('h-9 gap-2.5 rounded-lg px-2.5 text-sm font-medium', active ? 'bg-card text-foreground shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:bg-muted hover:text-foreground'),
      )}
    >
      <Icon className={cn('shrink-0', mobile ? 'size-5' : 'size-4', active && !mobile && 'text-primary')} aria-hidden="true" />
      <span>{mobile ? item.short : item.label}</span>
      {!!badge && (
        <span className={cn('rounded-md bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums', mobile ? 'absolute top-1.5 left-1/2 ml-2' : 'ml-auto')}>{badge}</span>
      )}
    </a>
  )
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const route = useRoute()
  const data = useData()
  const { theme, onThemeChange } = useTheme()
  const [incoming, setIncoming] = React.useState<IncomingOffer | null>(null)
  const [bmOpen, setBmOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const page = route.path || 'tableau-de-bord'

  // Offre envoyée par le favori « Envoyer à CV Matcher » (avant ou après connexion).
  React.useEffect(() => {
    const imported = takeImportedOffer() || sessionStorage.getItem('pending-offer')
    sessionStorage.removeItem('pending-offer')
    if (!imported) return
    const host = (imported.match(/Source : https?:\/\/(?:www\.)?([^/\s]+)/) || [])[1]
    const src = (imported.match(/Source : (https?:\/\/\S+)/) || [])[1]
    setIncoming({ text: imported, url: src, autorun: true, notice: `Offre importée${host ? ` depuis ${host}` : ''}. Ajoutez votre CV pour lancer l'analyse.` })
    navigate('analyser')
  }, [])

  React.useEffect(() => { setMenuOpen(false) }, [page, route.param])

  const importSuggested = async (o: SuggestedOffer) => {
    if (isLinkedIn(o.url)) {
      window.open(o.url, '_blank', 'noopener')
      throw new Error(LINKEDIN_HINT)
    }
    return api.fetchOffer(o.url)
  }
  const onAnalyze = async (o: SuggestedOffer) => {
    const d = await importSuggested(o)
    setIncoming({ text: d.text, url: d.url, autorun: true })
    navigate('analyser')
  }
  const onCompare = async (o: SuggestedOffer) => {
    const d = await importSuggested(o)
    data.setCompare((l) => (l.length >= MAX_COMPARE ? l : [...l, newCompareItem(d.text, o.url, `${o.title} · ${o.company}`)]))
  }

  const badges: Record<string, number | undefined> = {
    comparer: data.compare.length || undefined,
    offres: data.suggestions?.offers.filter((o) => o.isNew).length || undefined,
    candidatures: data.applications.filter(needsFollowUp).length || undefined,
  }
  const compareUrls = React.useMemo(() => new Set(data.compare.map((i) => i.url).filter(Boolean) as string[]), [data.compare])
  const clearIncoming = React.useCallback(() => setIncoming(null), [])
  const report = page === 'analyse' ? data.analyses.find((a) => a.id === route.param) : undefined
  const activePath = page === 'analyse' ? 'historique' : page

  const themeToggle = (
    <AnimatedThemeToggler theme={theme} onThemeChange={onThemeChange} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-[18px]" />
  )

  const sidebarContent = (onNavigate?: () => void) => (
    <>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label="Sections">
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="space-y-1">
            <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-subtle-foreground uppercase">{g.title}</p>
            {g.items.map((item) => <NavLink key={item.path} item={item} active={activePath === item.path} badge={badges[item.path]} onClick={onNavigate} />)}
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t p-3">
        {data.usage && (
          <div className="px-2.5">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Crédits IA du jour</span><span className="tabular-nums">{data.usage.limit - data.usage.used}/{data.usage.limit}</span></div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${100 - Math.min(100, (data.usage.used / data.usage.limit) * 100)}%` }} />
            </div>
          </div>
        )}
        <button type="button" onClick={() => { setBmOpen(true); onNavigate?.() }} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <BookmarkPlusIcon className="size-4" aria-hidden="true" /> Bouton LinkedIn
        </button>
        <div className="flex items-center gap-2 rounded-lg px-2.5 py-1">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary" aria-hidden="true">{data.user.name[0]?.toUpperCase()}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{data.user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{data.user.email}</span>
          </span>
          {themeToggle}
          <Button variant="ghost" size="icon-sm" onClick={onLogout} aria-label="Se déconnecter"><LogOutIcon aria-hidden="true" /></Button>
        </div>
      </div>
    </>
  )

  let content: React.ReactNode
  if (data.loading && page !== 'analyser') {
    content = <div className="flex justify-center py-24"><LoaderCircleIcon className="size-6 animate-spin text-primary" aria-label="Chargement" /></div>
  } else {
    switch (page) {
      case 'analyser': content = <SinglePage incoming={incoming} onIncomingHandled={clearIncoming} openBookmarklet={() => setBmOpen(true)} />; break
      case 'analyse': content = report
        ? <ResultsView key={report.id} doc={report} onBack={() => history.back()} backLabel="Retour" />
        : <div className="py-24 text-center"><p className="font-semibold">Analyse introuvable</p><Button variant="outline" className="mt-4" onClick={() => navigate('historique')}>Voir l'historique</Button></div>
        break
      case 'comparer': content = <ComparePage openBookmarklet={() => setBmOpen(true)} />; break
      case 'offres': content = <SuggestPage onAnalyze={onAnalyze} onCompare={onCompare} compareUrls={compareUrls} compareFull={data.compare.length >= MAX_COMPARE} />; break
      case 'candidatures': content = <ApplicationsPage />; break
      case 'historique': content = <HistoryPage />; break
      case 'cv': content = <CvsPage />; break
      case 'competences': content = <SkillsPage />; break
      case 'parametres': content = <SettingsPage onLogout={onLogout} />; break
      default: content = <DashboardPage />
    }
  }

  return (
    <div className="min-h-dvh">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar lg:flex" aria-label="Navigation principale">
        <div className="flex h-16 items-center border-b px-5">
          <a href="#/tableau-de-bord" aria-label="CV Matcher Pro, tableau de bord"><Logo /></a>
        </div>
        {sidebarContent()}
      </aside>

      <header className="no-print sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card/90 px-4 backdrop-blur-md lg:hidden">
        <a href="#/tableau-de-bord" aria-label="CV Matcher Pro, tableau de bord"><Logo /></a>
        <div className="flex items-center gap-1">
          {themeToggle}
          <Button variant="ghost" size="icon-sm" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu" aria-expanded={menuOpen}><MenuIcon aria-hidden="true" /></Button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-slate-950/40" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu" />
          <div className="animate-fade-up absolute inset-y-0 right-0 flex w-72 max-w-full flex-col border-l bg-sidebar shadow-lg">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <Logo />
              <Button variant="ghost" size="icon-sm" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"><XIcon aria-hidden="true" /></Button>
            </div>
            {sidebarContent(() => setMenuOpen(false))}
          </div>
        </div>
      )}

      <main className="px-4 pt-6 pb-24 sm:px-6 lg:pt-8 lg:pr-8 lg:pb-12 lg:pl-72">
        <div className="mx-auto max-w-6xl">{content}</div>
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex h-16 border-t bg-card/95 backdrop-blur-md lg:hidden" aria-label="Sections principales">
        {MOBILE_NAV.map((p) => {
          const item = ALL_ITEMS.find((i) => i.path === p)!
          return <NavLink key={p} item={item} mobile active={activePath === p} badge={badges[p]} />
        })}
        <button type="button" onClick={() => setMenuOpen(true)} className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground">
          <MenuIcon className="size-5" aria-hidden="true" /> Plus
        </button>
      </nav>

      <BookmarkletDialog open={bmOpen} onClose={() => setBmOpen(false)} />
    </div>
  )
}

function Root() {
  const route = useRoute()
  const [user, setUser] = React.useState<User | null | undefined>(undefined)

  React.useEffect(() => {
    api.me().then(({ user }) => setUser(user)).catch(() => setUser(null))
    const expired = () => { setUser(null); navigate('connexion') }
    window.addEventListener('auth:expired', expired)
    return () => window.removeEventListener('auth:expired', expired)
  }, [])

  // Une offre envoyée par le favori avant connexion est gardée pour après.
  React.useEffect(() => {
    if (user === null && location.hash.startsWith('#offer=')) {
      const offer = takeImportedOffer()
      if (offer) sessionStorage.setItem('pending-offer', offer)
      navigate('connexion')
    }
  }, [user])

  // Redirections selon l'état de connexion.
  React.useEffect(() => {
    if (user === undefined || location.hash.startsWith('#offer=')) return
    if (user && (route.path === 'connexion' || route.path === 'inscription' || route.path === '')) navigate('tableau-de-bord')
    if (!user && !PUBLIC.has(route.path)) navigate('connexion')
  }, [user, route.path])

  const logout = async () => {
    await api.logout().catch(() => {})
    setUser(null)
    navigate('')
  }

  if (user === undefined) {
    return <div className="flex min-h-dvh items-center justify-center"><LoaderCircleIcon className="size-6 animate-spin text-primary" aria-label="Chargement" /></div>
  }
  if (['mentions-legales', 'confidentialite', 'cgu'].includes(route.path)) return <LegalPage slug={route.path} />
  if (!user) {
    if (route.path === 'connexion' || route.path === 'inscription') return <AuthPage key={route.path} mode={route.path} onAuth={setUser} />
    return <LandingPage />
  }
  return (
    <DataProvider key={user.id} user={user}>
      <Shell onLogout={logout} />
    </DataProvider>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <Root />
      </ToastProvider>
    </MotionConfig>
  )
}
