export type Impact = 'high' | 'medium' | 'low'

export interface Analysis {
  score: number
  summary: string
  breakdown: { category: string; score: number }[]
  matched_keywords: string[]
  missing_keywords: string[]
  strengths: string[]
  gaps: string[]
  priority_actions: string[]
  recommendations: { title: string; detail: string; example: string; impact: Impact }[]
}

export interface User { id: string; email: string; name: string; createdAt: string }

interface Doc { id: string; updatedAt?: string }

export interface CvDoc extends Doc { name: string; text: string; isDefault?: boolean; createdAt?: string }

export interface TailorOutput { cv: string; changes: { section: string; change: string; reason: string }[]; generatedAt: string }
export interface LetterOutput { subject: string; body: string; generatedAt: string }
export interface InterviewOutput { questions: { category: string; question: string; why: string; tips: string }[]; generatedAt: string }
export interface SalaryOutput { low: number; median: number; high: number; basis: string; rationale: string; tips: string[]; generatedAt: string }
export type ToolName = 'tailor' | 'letter' | 'interview' | 'salary'

export interface AnalysisDoc extends Doc {
  createdAt: string
  source?: string
  offerTitle: string
  offerUrl?: string
  offerText: string
  cvId?: string
  cvName?: string
  cvText: string
  result: Analysis
  tools: { tailor?: TailorOutput; letter?: LetterOutput; interview?: InterviewOutput; salary?: SalaryOutput }
}

export const APP_STATUSES = ['a-postuler', 'postule', 'entretien', 'offre', 'refuse'] as const
export type AppStatus = (typeof APP_STATUSES)[number]

export interface ApplicationDoc extends Doc {
  title: string
  company: string
  url?: string
  status: AppStatus
  createdAt: string
  appliedAt?: string
  followUpAt?: string
  contact?: string
  notes?: string
  analysisId?: string
  score?: number
}

export interface SuggestedOffer {
  title: string
  company: string
  location: string
  contract: string
  url: string
  match_score: number
  why: string
  isNew?: boolean
}
export interface SuggestionsDoc extends Doc { offers: SuggestedOffer[]; at: string; criteria?: { location: string; contract: string; remote: boolean } }

export interface AlertSettings extends Doc {
  enabled: boolean
  frequency: 'daily' | 'weekly'
  location: string
  contract: string
  remote: boolean
  lastRunAt?: string
  unseen?: number
  lastError?: string
}

export interface CompareItem {
  id: string
  title: string
  text: string
  url?: string
  status: 'idle' | 'loading' | 'done' | 'error'
  analysisId?: string
  score?: number
  error?: string
}
export interface CompareDoc extends Doc { items: CompareItem[] }

export interface SkillPlanDoc extends Doc {
  plan: {
    summary: string
    skills: { name: string; priority: 'haute' | 'moyenne' | 'basse'; why: string; duration: string; steps: string[]; resources: { title: string; type: string }[] }[]
  }
  missing: { keyword: string; count: number }[]
  basedOn: number
  generatedAt: string
}

export interface Usage { used: number; limit: number; cost: Record<string, number> }

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !url.startsWith('/api/auth/')) window.dispatchEvent(new Event('auth:expired'))
  if (!res.ok) throw new ApiError(data.error || 'Une erreur est survenue, réessayez.', res.status)
  return data as T
}

const post = <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {})

export const api = {
  me: () => request<{ user: User | null }>('GET', '/api/auth/me'),
  signup: (b: { email: string; password: string; name: string }) => post<{ user: User }>('/api/auth/signup', b),
  login: (b: { email: string; password: string }) => post<{ user: User }>('/api/auth/login', b),
  logout: () => post<{ ok: true }>('/api/auth/logout'),
  rename: (name: string) => request<{ user: User }>('PATCH', '/api/auth/me', { name }),
  deleteAccount: (password: string) => request<{ ok: true }>('DELETE', '/api/auth/account', { password }),

  list: <T>(kind: string) => request<T[]>('GET', `/api/docs/${kind}`),
  put: <T extends Doc>(kind: string, doc: T) => request<T>('PUT', `/api/docs/${kind}/${encodeURIComponent(doc.id)}`, doc),
  remove: (kind: string, id: string) => request<{ ok: true }>('DELETE', `/api/docs/${kind}/${encodeURIComponent(id)}`),
  usage: () => request<Usage>('GET', '/api/usage'),

  fetchOffer: (url: string) => post<{ title: string; company: string; host: string; url: string; text: string }>('/api/fetch-offer', { url }),
  analyze: (b: { cv: string; offer: string; offerUrl?: string; cvId?: string; cvName?: string; source?: string }) => post<AnalysisDoc>('/api/analyze', b),
  tool: (analysisId: string, tool: ToolName) => post<AnalysisDoc>(`/api/analyses/${analysisId}/tools/${tool}`),
  skillsPlan: () => post<SkillPlanDoc>('/api/skills-plan'),
  bestCv: (offer: string) => post<{ ranking: { cv_id: string; score: number; reason: string }[] }>('/api/best-cv', { offer }),
  suggest: (b: { location: string; contract: string; remote: boolean; cv?: string }) => post<SuggestionsDoc>('/api/suggest-offers', b),
  alertsSeen: () => post<{ ok: true }>('/api/alerts/seen'),
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
