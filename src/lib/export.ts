const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'document'

const isHeading = (line: string) => line.length > 2 && line.length < 60 && line === line.toUpperCase() && /[A-ZÀ-Ý]/.test(line)

/** Exporte un texte structuré (titres en majuscules, puces « - ») en document Word. */
export async function downloadDocx(title: string, text: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  const paragraphs = text.split('\n').map((raw) => {
    const line = raw.trimEnd()
    if (!line.trim()) return new Paragraph({ text: '' })
    if (isHeading(line.trim())) return new Paragraph({ text: line.trim(), heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 } })
    if (/^\s*[-•]\s+/.test(line)) return new Paragraph({ children: [new TextRun(line.replace(/^\s*[-•]\s+/, ''))], bullet: { level: 0 } })
    return new Paragraph({ children: [new TextRun(line)], spacing: { after: 80 } })
  })
  const doc = new Document({
    creator: 'CV Matcher Pro',
    title,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ properties: {}, children: paragraphs }],
  })
  const blob = await Packer.toBlob(doc)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${slug(title)}.docx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Ouvre une page imprimable (Imprimer → Enregistrer en PDF). */
export function printDocument(title: string, text: string) {
  const w = window.open('', '_blank', 'noopener=no')
  if (!w) return false
  const body = text.split('\n').map((raw) => {
    const line = raw.trim()
    if (!line) return '<br>'
    if (isHeading(line)) return `<h2>${escapeHtml(line)}</h2>`
    if (/^[-•]\s+/.test(line)) return `<li>${escapeHtml(line.replace(/^[-•]\s+/, ''))}</li>`
    return `<p>${escapeHtml(line)}</p>`
  }).join('\n')
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font:11pt/1.5 Calibri,Arial,sans-serif;color:#111;max-width:720px;margin:32px auto;padding:0 24px}
h2{font-size:12pt;letter-spacing:.04em;border-bottom:1px solid #ccc;padding-bottom:2px;margin:18px 0 6px}
p{margin:0 0 4px}li{margin:0 0 2px 18px}@page{margin:18mm}</style></head><body>${body}</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
  return true
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}
