import * as React from 'react'
import {
  api, newId,
  type AlertSettings, type AnalysisDoc, type ApplicationDoc, type CompareItem, type CvDoc, type SkillPlanDoc, type SuggestionsDoc, type Usage, type User,
} from '@/lib/api'
import { store as local } from '@/lib/storage'
import { useToast } from '@/components/toast'

interface Data {
  user: User
  loading: boolean
  cvs: CvDoc[]
  analyses: AnalysisDoc[]
  applications: ApplicationDoc[]
  compare: CompareItem[]
  suggestions: SuggestionsDoc | null
  alerts: AlertSettings | null
  skillPlan: SkillPlanDoc | null
  usage: Usage | null
  defaultCv: CvDoc | null
  saveCv: (cv: CvDoc) => Promise<CvDoc>
  removeCv: (id: string) => Promise<void>
  addAnalysis: (doc: AnalysisDoc) => void
  removeAnalysis: (id: string) => Promise<void>
  saveApplication: (app: ApplicationDoc) => Promise<void>
  removeApplication: (id: string) => Promise<void>
  setCompare: (updater: (items: CompareItem[]) => CompareItem[]) => void
  setSuggestions: (doc: SuggestionsDoc) => void
  saveAlerts: (s: AlertSettings) => Promise<void>
  setSkillPlan: (doc: SkillPlanDoc) => void
  refreshUsage: () => void
  setUser: (u: User) => void
}

const DataContext = React.createContext<Data | null>(null)

export function useData() {
  const ctx = React.useContext(DataContext)
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>')
  return ctx
}

const byDate = <T extends { createdAt?: string; updatedAt?: string }>(a: T, b: T) =>
  (b.createdAt || b.updatedAt || '').localeCompare(a.createdAt || a.updatedAt || '')

export function DataProvider({ user: initialUser, children }: { user: User; children: React.ReactNode }) {
  const toast = useToast()
  const [user, setUser] = React.useState(initialUser)
  const [loading, setLoading] = React.useState(true)
  const [cvs, setCvs] = React.useState<CvDoc[]>([])
  const [analyses, setAnalyses] = React.useState<AnalysisDoc[]>([])
  const [applications, setApplications] = React.useState<ApplicationDoc[]>([])
  const [compare, setCompareState] = React.useState<CompareItem[]>([])
  const [suggestions, setSuggestions] = React.useState<SuggestionsDoc | null>(null)
  const [alerts, setAlerts] = React.useState<AlertSettings | null>(null)
  const [skillPlan, setSkillPlan] = React.useState<SkillPlanDoc | null>(null)
  const [usage, setUsage] = React.useState<Usage | null>(null)

  const fail = React.useCallback((e: unknown) => toast((e as Error).message || 'Enregistrement impossible.', 'error'), [toast])
  const refreshUsage = React.useCallback(() => { api.usage().then(setUsage).catch(() => {}) }, [])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [c, a, ap, cmp, sug, set, sk] = await Promise.all([
          api.list<CvDoc>('cv'), api.list<AnalysisDoc>('analysis'), api.list<ApplicationDoc>('application'),
          api.list<{ id: string; items: CompareItem[] }>('compare'), api.list<SuggestionsDoc>('suggestions'),
          api.list<AlertSettings>('settings'), api.list<SkillPlanDoc>('skillplan'),
        ])
        if (cancelled) return
        let cvList = c
        let compareItems = cmp.find((d) => d.id === 'current')?.items || []

        // Reprise des données de la version sans compte (stockées dans le navigateur).
        const localCv = local.get('cv')
        if (!cvList.length && localCv && localCv.trim().split(/\s+/).length >= 30) {
          const doc = await api.put<CvDoc>('cv', { id: newId(), name: 'Mon CV', text: localCv, isDefault: true, createdAt: new Date().toISOString() })
          cvList = [doc]
        }
        const localCompare = local.get('compare')
        if (!compareItems.length && localCompare) {
          try {
            const items = (JSON.parse(localCompare) as CompareItem[]).map((i) => ({ ...i, status: 'idle' as const, analysisId: undefined }))
            if (items.length) {
              compareItems = items
              await api.put('compare', { id: 'current', items })
            }
          } catch { /* ancien format ignoré */ }
        }
        local.remove('cv')
        local.remove('compare')

        setCvs(cvList)
        setAnalyses([...a].sort(byDate))
        setApplications(ap)
        setCompareState(compareItems.map((i) => (i.status === 'loading' ? { ...i, status: 'idle' } : i)))
        setSuggestions(sug.find((d) => d.id === 'latest') || null)
        setAlerts(set.find((d) => d.id === 'alerts') || null)
        setSkillPlan(sk.find((d) => d.id === 'latest') || null)
      } catch (e) {
        fail(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    refreshUsage()
    return () => { cancelled = true }
  }, [fail, refreshUsage])

  // Le comparatif est enregistré avec un léger délai pour regrouper les mises à jour.
  const compareTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const setCompare = React.useCallback((updater: (items: CompareItem[]) => CompareItem[]) => {
    setCompareState((prev) => {
      const next = updater(prev)
      clearTimeout(compareTimer.current)
      compareTimer.current = setTimeout(() => {
        api.put('compare', { id: 'current', items: next.map((i) => (i.status === 'loading' ? { ...i, status: 'idle' as const } : i)) }).catch(fail)
      }, 400)
      return next
    })
  }, [fail])

  const value: Data = {
    user,
    loading,
    cvs,
    analyses,
    applications,
    compare,
    suggestions,
    alerts,
    skillPlan,
    usage,
    defaultCv: cvs.find((c) => c.isDefault) || cvs[0] || null,
    saveCv: async (cv) => {
      const saved = await api.put<CvDoc>('cv', cv)
      setCvs((list) => {
        const others = list.filter((c) => c.id !== saved.id).map((c) => (saved.isDefault ? { ...c, isDefault: false } : c))
        return [saved, ...others]
      })
      return saved
    },
    removeCv: async (id) => {
      await api.remove('cv', id)
      setCvs((list) => list.filter((c) => c.id !== id))
    },
    addAnalysis: (doc) => {
      setAnalyses((list) => [doc, ...list.filter((a) => a.id !== doc.id)].sort(byDate))
      refreshUsage()
    },
    removeAnalysis: async (id) => {
      await api.remove('analysis', id)
      setAnalyses((list) => list.filter((a) => a.id !== id))
    },
    saveApplication: async (app) => {
      setApplications((list) => [app, ...list.filter((a) => a.id !== app.id)])
      try {
        await api.put('application', app)
      } catch (e) {
        fail(e)
      }
    },
    removeApplication: async (id) => {
      setApplications((list) => list.filter((a) => a.id !== id))
      await api.remove('application', id).catch(fail)
    },
    setCompare,
    setSuggestions: (doc) => { setSuggestions(doc); refreshUsage() },
    saveAlerts: async (s) => { setAlerts(await api.put<AlertSettings>('settings', s)) },
    setSkillPlan: (doc) => { setSkillPlan(doc); refreshUsage() },
    refreshUsage,
    setUser,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
