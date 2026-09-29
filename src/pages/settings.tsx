import * as React from 'react'
import { BellIcon, DatabaseIcon, DownloadIcon, GaugeIcon, LogOutIcon, Trash2Icon, UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Notice, PageHeader, Panel, fieldClass } from '@/components/common'
import { useToast } from '@/components/toast'
import { CONTRACTS } from '@/pages/suggest'
import { api, type AlertSettings } from '@/lib/api'
import { useData } from '@/lib/store'
import { cn } from '@/lib/utils'

export function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const { user, setUser, alerts, saveAlerts, usage, refreshUsage, defaultCv } = useData()
  const toast = useToast()
  const [name, setName] = React.useState(user.name)
  const [form, setForm] = React.useState<AlertSettings>(alerts || { id: 'alerts', enabled: false, frequency: 'weekly', location: '', contract: '', remote: false })
  const [password, setPassword] = React.useState('')
  const [deleteError, setDeleteError] = React.useState('')

  React.useEffect(() => { refreshUsage() }, [refreshUsage])

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    try { setUser((await api.rename(name)).user); toast('Profil enregistré.') } catch (err) { toast((err as Error).message, 'error') }
  }

  const saveAlertForm = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveAlerts({ ...form, lastError: '' })
      toast(form.enabled ? `Alerte ${form.frequency === 'daily' ? 'quotidienne' : 'hebdomadaire'} activée.` : 'Alerte désactivée.')
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeleteError('')
    if (!confirm('Supprimer définitivement votre compte et toutes vos données ? Cette action est irréversible.')) return
    try {
      await api.deleteAccount(password)
      onLogout()
    } catch (err) {
      setDeleteError((err as Error).message)
    }
  }

  const pct = usage ? Math.min(100, (usage.used / usage.limit) * 100) : 0

  return (
    <div>
      <PageHeader title="Paramètres" description="Profil, alertes, utilisation et données personnelles." actions={<Button variant="outline" onClick={onLogout}><LogOutIcon aria-hidden="true" /> Se déconnecter</Button>} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel icon={UserIcon} title="Profil" subtitle={user.email}>
          <form onSubmit={saveName} className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="set-name" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Prénom</label>
              <input id="set-name" value={name} onChange={(e) => setName(e.target.value)} className={cn(fieldClass, 'h-10 px-3')} />
            </div>
            <Button type="submit" variant="outline" disabled={!name.trim() || name === user.name}>Enregistrer</Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">Compte créé le {new Date(user.createdAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })}.</p>
        </Panel>

        <Panel icon={GaugeIcon} title="Utilisation de l'IA" subtitle="Crédits du jour, réinitialisés à minuit (UTC)">
          {usage ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums">{usage.used}</span>
                <span className="text-sm text-muted-foreground">/ {usage.limit} crédits utilisés aujourd'hui</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={usage.limit} aria-valuenow={usage.used} aria-label="Crédits utilisés">
                <div className={cn('h-full rounded-full', pct > 85 ? 'bg-destructive' : pct > 60 ? 'bg-warning' : 'bg-primary')} style={{ width: `${pct}%` }} />
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <li>Analyse : 1 crédit</li><li>CV, lettre, entretien, salaire : 1</li>
                <li>Plan de compétences : 1</li><li>Recherche d'offres : 3</li>
              </ul>
            </>
          ) : <div className="skeleton h-16 rounded-lg" />}
        </Panel>

        <Panel icon={BellIcon} title="Alertes d'offres" subtitle="Claude cherche de nouvelles offres pour vous, automatiquement" className="lg:col-span-2">
          <form onSubmit={saveAlertForm} className="space-y-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="size-4 accent-[var(--primary)]" />
              Activer les alertes
            </label>
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end">
              <div>
                <label htmlFor="al-loc" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Ville ou région</label>
                <input id="al-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Toute la France" disabled={!form.enabled} className={cn(fieldClass, 'h-10 px-3')} />
              </div>
              <div>
                <label htmlFor="al-contract" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Contrat</label>
                <select id="al-contract" value={form.contract} onChange={(e) => setForm({ ...form, contract: e.target.value })} disabled={!form.enabled} className={cn(fieldClass, 'h-10 px-3')}>
                  {CONTRACTS.map((c) => <option key={c} value={c}>{c || 'Tous'}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="al-freq" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Fréquence</label>
                <select id="al-freq" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as AlertSettings['frequency'] })} disabled={!form.enabled} className={cn(fieldClass, 'h-10 px-3')}>
                  <option value="weekly">Chaque semaine</option>
                  <option value="daily">Chaque jour</option>
                </select>
              </div>
              <label className="flex h-10 items-center gap-2.5 rounded-lg border border-input px-3 text-sm font-medium">
                <input type="checkbox" checked={form.remote} onChange={(e) => setForm({ ...form, remote: e.target.checked })} disabled={!form.enabled} className="size-4 accent-[var(--primary)]" />
                Télétravail
              </label>
            </div>
            {!defaultCv && form.enabled && <Notice error="Ajoutez un CV dans « Mes CV » : les alertes utilisent votre CV par défaut." />}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Chaque recherche utilise 3 crédits. Les alertes s'exécutent tant que le serveur est allumé.
                {alerts?.lastRunAt && ` Dernière recherche : ${new Date(alerts.lastRunAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}.`}
              </p>
              <Button type="submit">Enregistrer l'alerte</Button>
            </div>
          </form>
        </Panel>

        <Panel icon={DatabaseIcon} title="Vos données" subtitle="Conformément au RGPD" className="lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">Exporter mes données</h3>
              <p className="mt-1 text-sm text-muted-foreground">Téléchargez l'ensemble de vos CV, analyses, candidatures et réglages au format JSON.</p>
              <Button asChild variant="outline" className="mt-3">
                <a href="/api/export" download><DownloadIcon aria-hidden="true" /> Télécharger l'export</a>
              </Button>
            </div>
            <form onSubmit={deleteAccount}>
              <h3 className="text-sm font-semibold text-destructive">Supprimer mon compte</h3>
              <p className="mt-1 text-sm text-muted-foreground">Supprime définitivement votre compte et toutes vos données.</p>
              <div className="mt-3 flex gap-2">
                <label htmlFor="del-pw" className="sr-only">Mot de passe</label>
                <input id="del-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Votre mot de passe" autoComplete="current-password" className={cn(fieldClass, 'h-10 flex-1 px-3')} />
                <Button type="submit" variant="outline" disabled={!password} className="border-destructive/40 text-destructive hover:bg-destructive-soft">
                  <Trash2Icon aria-hidden="true" /> Supprimer
                </Button>
              </div>
              {deleteError && <p className="mt-2 text-xs text-destructive" role="alert">{deleteError}</p>}
            </form>
          </div>
        </Panel>
      </div>
    </div>
  )
}
