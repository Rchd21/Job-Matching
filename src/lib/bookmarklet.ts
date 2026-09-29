// Exécuté sur la page de l'offre (LinkedIn ou autre) via le favori : doit rester autonome, en ES5.
function sendToCvMatcher(origin: string) {
  var q = function (sels: string[]) {
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]) as HTMLElement | null
      var t = el && (el.innerText || el.textContent || '').trim()
      if (t) return t
    }
    return ''
  }
  var htmlText = function (html: string) {
    var marked = String(html).replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/ul|\/ol)\b[^>]*>/gi, '$&\n')
    var doc = new DOMParser().parseFromString(marked, 'text/html')
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
  }
  var title = '', company = '', body = ''
  var scripts = document.querySelectorAll('script[type="application/ld+json"]')
  for (var i = 0; i < scripts.length && !body; i++) {
    try {
      var items = ([] as any[]).concat(JSON.parse(scripts[i].textContent || '')).reduce(function (acc: any[], d: any) {
        return acc.concat(d && d['@graph'] ? d['@graph'] : [d])
      }, [])
      var job = items.filter(function (d: any) { return d && ([] as any[]).concat(d['@type']).indexOf('JobPosting') >= 0 })[0]
      if (job) {
        var org = job.hiringOrganization
        title = job.title || ''
        company = typeof org === 'string' ? org : (org && org.name) || ''
        body = htmlText(job.description || '')
      }
    } catch (e) {}
  }
  var src = location.origin + location.pathname
  if (/(^|\.)linkedin\.com$/.test(location.hostname)) {
    title = q(['.job-details-jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title', '.top-card-layout__title']) || title
    company = q(['.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name', '.topcard__org-name-link']) || company
    body = q(['#job-details', '.jobs-description__content', '.jobs-description-content__text', '.show-more-less-html__markup', '.description__text']) || body
    var id = location.href.match(/currentJobId=(\d+)/)
    if (id) src = 'https://www.linkedin.com/jobs/view/' + id[1] + '/'
  }
  var sel = String(window.getSelection() || '').trim()
  if (sel.length > 150) body = sel
  if (!body) body = q(['main', 'article', '[role="main"]', 'body'])
  if (!title) title = q(['h1']) || document.title
  if (body.length < 100) {
    alert("CV Matcher : texte de l'offre introuvable. Sélectionnez la description à la souris, puis recliquez sur le favori.")
    return
  }
  var text = [title, company, 'Source : ' + src].filter(Boolean).join('\n') + '\n\n' + body
  var w = window.open(origin + '/#offer=' + encodeURIComponent(text.slice(0, 30000)), 'cvmatcher')
  if (!w) alert('CV Matcher : autorisez les fenêtres pop-up pour ce site, puis recliquez.')
}

export function bookmarkletHref(origin: string) {
  // esbuild conserve le corps de la fonction ; on retire les annotations de type à la compilation.
  return 'javascript:' + encodeURIComponent('(' + sendToCvMatcher.toString() + ')(' + JSON.stringify(origin) + ')')
}

export function takeImportedOffer(): string | null {
  const m = location.hash.match(/^#offer=([\s\S]*)$/)
  if (!m) return null
  history.replaceState(null, '', location.pathname)
  try { return decodeURIComponent(m[1]) } catch { return null }
}
