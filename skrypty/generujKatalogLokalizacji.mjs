// Generuje statyczny katalog lokalizacji (indeks + pliki województw) z kartoteki CSV.
// Uruchomienie: npm run katalog:lokalizacje  (wymaga loadera TypeScript z testów, bo korzysta z modułów z src/).
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const korzen = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const plikCsv = join(korzen, 'src/kartoteki/lokalizacje/dane/kartoteka_lokalizacje_miejscowosci_2019.csv')
const katalogWyjscia = join(korzen, 'public/dane/lokalizacje')

const { importujLokalizacjeZCsv } = await import(pathToFileURL(join(korzen, 'src/kartoteki/lokalizacje/importerLokalizacji.ts')).href)
const { zbudujKatalogStatyczny } = await import(pathToFileURL(join(korzen, 'src/kartoteki/lokalizacje/katalogStatyczny.ts')).href)

const wynik = importujLokalizacjeZCsv(readFileSync(plikCsv, 'utf8'))
if (wynik.bledy.length > 0) {
  console.error(`Kartoteka CSV zawiera błędy (${wynik.bledy.length}), np. wiersz ${wynik.bledy[0].wiersz}: ${wynik.bledy[0].komunikat}`)
  process.exit(1)
}

const katalog = zbudujKatalogStatyczny(wynik.lokalizacje)

mkdirSync(katalogWyjscia, { recursive: true })
for (const nazwa of readdirSync(katalogWyjscia)) {
  if (nazwa.endsWith('.json')) rmSync(join(katalogWyjscia, nazwa))
}

let rozmiar = 0
for (const opis of katalog.indeks.wojewodztwa) {
  const tresc = JSON.stringify(katalog.pliki.get(opis.kod))
  writeFileSync(join(katalogWyjscia, opis.plik), tresc)
  rozmiar += tresc.length
}
const trescIndeksu = JSON.stringify(katalog.indeks)
writeFileSync(join(katalogWyjscia, 'indeks.json'), trescIndeksu)

console.log(`Zapisano katalog lokalizacji: ${wynik.lokalizacje.length} rekordów, ${katalog.indeks.wojewodztwa.length} plików województw (${(rozmiar / 1048576).toFixed(1)} MB), indeks ${(trescIndeksu.length / 1024).toFixed(0)} KB, ${katalog.indeks.nazwy.length} unikalnych nazw.`)
