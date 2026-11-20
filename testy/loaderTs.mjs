import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

function czyLokalnyImport(specifier) {
  return specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file:')
}

export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve)
  } catch (blad) {
    if (!czyLokalnyImport(specifier) || path.extname(specifier)) {
      throw blad
    }

    const katalogRodzica = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : process.cwd()
    const sciezka = specifier.startsWith('file:')
      ? fileURLToPath(specifier)
      : path.resolve(katalogRodzica, specifier)
    const sciezkaTs = `${sciezka}.ts`

    if (!existsSync(sciezkaTs)) {
      throw blad
    }

    return defaultResolve(pathToFileURL(sciezkaTs).href, context, defaultResolve)
  }
}

// Odpowiednik importu `?raw` z Vite: moduł eksportuje zawartość pliku jako tekst.
export async function load(url, context, nextLoad) {
  if (!url.startsWith('file:') || new URL(url).search !== '?raw') return nextLoad(url, context)
  const { readFile } = await import('node:fs/promises')
  const tresc = await readFile(fileURLToPath(new URL(url.split('?')[0])), 'utf8')
  return { format: 'module', source: `export default ${JSON.stringify(tresc)}`, shortCircuit: true }
}
