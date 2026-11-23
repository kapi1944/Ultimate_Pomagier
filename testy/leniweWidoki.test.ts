import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function odczytajZrodlo(sciezka: string) {
  return readFileSync(new URL(sciezka, import.meta.url), 'utf8')
}

const uklad = odczytajZrodlo('../src/aplikacja/layout/UkladAplikacji.tsx')
const leniwe = odczytajZrodlo('../src/aplikacja/layout/leniweWidoki.ts')

// Widok startowy (Pulpit) pozostaje statyczny — to jedyny widok, który wolno importować bezpośrednio w układzie.
const widokiStatyczne = ['WidokPulpitu']

test('układ aplikacji nie importuje statycznie widoków poza pulpitem', () => {
  const statyczneImporty = [...uklad.matchAll(/^import\s+(?!type\b)([^;\n]*?)\s+from\s+'([^']+)'/gm)]
    .filter(([, , sciezka]) => !sciezka.startsWith('./leniweWidoki'))
    .flatMap(([, nazwy]) => nazwy.match(/\bWidok[A-Za-z]+/g) ?? [])
    .filter((nazwa) => !widokiStatyczne.includes(nazwa))
  assert.deepEqual(statyczneImporty, [], 'Widoki muszą być ładowane leniwie przez leniweWidoki.ts, inaczej wracają do pakietu startowego.')
})

test('każdy widok użyty w układzie jest eksportowany jako leniwy komponent i ładowany dynamicznie', () => {
  const uzyte = [...new Set([...uklad.matchAll(/(?<!\w)<(Widok[A-Za-z]+)\b/g)].map((dopasowanie) => dopasowanie[1]))]
    .filter((nazwa) => nazwa !== 'WidokAplikacji' && !widokiStatyczne.includes(nazwa))
  assert.ok(uzyte.length >= 20, 'Układ powinien renderować wszystkie widoki aplikacji.')
  for (const nazwa of uzyte) {
    assert.match(leniwe, new RegExp(`export const ${nazwa} = lazy\\(wczytywaczeWidokow\\.${nazwa}\\)`), `Brak leniwego eksportu ${nazwa}`)
    assert.match(leniwe, new RegExp(`${nazwa}: \\(\\) => import\\(`), `Brak dynamicznego importu ${nazwa}`)
  }
})

test('widoki są renderowane w Suspense z komunikatem dla czytnika ekranu, a pobieranie w tle jest sprzątane', () => {
  assert.match(uklad, /<Suspense fallback=\{<p [^>]*role="status">Wczytywanie widoku…<\/p>\}><WidokAplikacji/)
  assert.match(uklad, /useEffect\(\(\) => wczytajWidokiWTle\(\), \[\]\)/)
  assert.match(leniwe, /return \(\) => \{\s+anulowano = true/)
})

test('edytor programu nie odczytuje stanu zniszczonego edytora po ponownym podłączeniu efektów', () => {
  const edytor = odczytajZrodlo('../src/moduly/dokumenty/generatory/programy_szkolen/komponenty/EdytorProgramuWysiwyg.tsx')
  const efekty = edytor.match(/!edytor \|\| edytor\.isDestroyed/g) ?? []
  assert.equal(efekty.length, 2, 'Oba efekty korzystające z edytora muszą sprawdzać isDestroyed.')
})
