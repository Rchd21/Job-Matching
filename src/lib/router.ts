import * as React from 'react'

// Routage par hash (#/historique, #/analyse/<id>…), compatible avec le bouton Retour et l'hébergement statique.
export interface Route { path: string; param?: string }

export function parseHash(hash = location.hash): Route {
  if (hash.startsWith('#offer=')) return { path: 'analyser' }
  const [path = '', param] = hash.replace(/^#\/?/, '').split('/')
  return { path, param: param ? decodeURIComponent(param) : undefined }
}

export function navigate(path: string) {
  const target = `#/${path}`
  if (location.hash !== target) location.hash = target
  window.scrollTo({ top: 0 })
}

export function useRoute(): Route {
  const [route, setRoute] = React.useState<Route>(() => parseHash())
  React.useEffect(() => {
    const sync = () => setRoute(parseHash())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  return route
}
