export const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)
export const MIN_WORDS = 30
export const offerTitle = (text: string) => text.trim().split('\n')[0].replace(/^[-•\s]+/, '').slice(0, 120)
export const isLinkedIn = (url: string) => /(^|\.)linkedin\.com/i.test(url)
export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }
