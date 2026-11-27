import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DOMParser } from '@xmldom/xmldom'
import type { ElementObrazuDokumentu, ElementTekstowyDokumentu } from '../src/wspolne/dokumenty/typyDokumentu.ts'

// Importer DOCX korzysta z DOMParser przeglądarki – w Node podstawiamy xmldom.
;(globalThis as unknown as { DOMParser: unknown }).DOMParser ??= DOMParser

const { importujDokumentDocx } = await import('../src/wspolne/import/importujDokumentDocx.ts')
const { utworzSzablonRoboczyZDokumentu } = await import('../src/moduly/dokumenty/replikator_dokumentow/parserDocxReplikatora.ts')

async function sprawdz(nazwa: string, testRegresji: () => Promise<void> | void) {
  await testRegresji()
  console.log(`OK: ${nazwa}`)
}

const bajty = readFileSync(new URL('./fixtures/FE_certyfikat_COP_pion.docx', import.meta.url))
const dokument = await importujDokumentDocx(new File([bajty], 'FE_certyfikat_COP_pion (1).docx'))
const elementy = dokument.strony[0].elementy
const teksty = elementy.filter((element): element is ElementTekstowyDokumentu => element.rodzaj === 'tekst')
const obrazy = elementy.filter((element): element is ElementObrazuDokumentu => element.rodzaj === 'obraz')
const tekst = (tresc: string) => {
  const znaleziony = teksty.find((element) => element.tekst === tresc)
  assert.ok(znaleziony, `Brak tekstu: ${tresc}`)
  return znaleziony
}
const blisko = (wartosc: number, oczekiwana: number, tolerancja: number, opis: string) =>
  assert.ok(Math.abs(wartosc - oczekiwana) <= tolerancja, `${opis}: ${wartosc} ≠ ${oczekiwana} ± ${tolerancja}`)

await sprawdz('certyfikat FE: rozpoznany typ i jedna strona A4', () => {
  assert.equal(dokument.metadane.mozliwyTypDokumentu, 'certyfikat')
  assert.equal(dokument.strony.length, 1)
  assert.equal(dokument.strony[0].szerokoscMm, 210)
  assert.equal(dokument.strony[0].wysokoscMm, 297)
})

await sprawdz('certyfikat FE: obrazy mają rozmiar z wp:extent i pozycję z wp:anchor', () => {
  assert.equal(obrazy.length, 3)
  const [naglowek, logo] = obrazy
  const stopka = obrazy.find((obraz) => obraz.id.startsWith('stopka-')) as ElementObrazuDokumentu

  blisko(naglowek.pozycja.szerokosc, 159.8, 0.2, 'szerokość grafiki nagłówka')
  blisko(naglowek.pozycja.wysokosc, 58.2, 0.2, 'wysokość grafiki nagłówka')
  blisko(naglowek.pozycja.x + naglowek.pozycja.szerokosc, 185, 0.2, 'grafika nagłówka wyrównana do prawego marginesu')
  blisko(logo.pozycja.szerokosc, 54.8, 0.2, 'szerokość logo COP')
  blisko(logo.pozycja.x, 39.7, 0.2, 'logo COP przesunięte od marginesu')
  blisko(stopka.pozycja.szerokosc, 193.7, 0.2, 'szerokość pasa logotypów w stopce')
  blisko(stopka.pozycja.x + stopka.pozycja.szerokosc / 2, 105, 0.2, 'stopka wyśrodkowana na marginesach')
  assert.ok(stopka.pozycja.y > 265 && stopka.pozycja.y + stopka.pozycja.wysokosc < 297, 'stopka przy dolnej krawędzi strony')
})

await sprawdz('certyfikat FE: tabulator 15 mm, kroje i rozmiary z runu z tekstem', () => {
  teksty.forEach((element) => blisko(element.pozycja.x, 40, 0.1, `wcięcie tabulatorem: ${element.tekst}`))
  assert.equal(tekst('IMIĘ I NAZWISKO').styl.rozmiarCzcionki, 28)
  assert.equal(tekst('IMIĘ I NAZWISKO').styl.pogrubienie, true)
  assert.equal(tekst('Tytuł szkolenia').styl.rozmiarCzcionki, 20)
  assert.equal(tekst('Data szkolenia').styl.rozmiarCzcionki, 14)
  assert.equal(tekst('Data szkolenia').styl.pogrubienie, false, 'pogrubiony tabulator nie może pogrubiać tekstu')
  assert.equal(tekst('Data szkolenia').styl.krojCzcionki, 'Open Sans Condensed')
})

await sprawdz('certyfikat FE: puste akapity i interlinia zachowują pionowy rytm bez nakładania', () => {
  const posortowane = [...teksty].sort((a, b) => a.pozycja.y - b.pozycja.y)

  posortowane.slice(1).forEach((element, indeks) => {
    const poprzedni = posortowane[indeks]
    assert.ok(element.pozycja.y >= poprzedni.pozycja.y + poprzedni.pozycja.wysokosc, `${element.tekst} nachodzi na ${poprzedni.tekst}`)
  })

  posortowane.forEach((element) => {
    const minimalnaLinia = element.styl.rozmiarCzcionki * (25.4 / 72)
    assert.ok((element.styl.wysokoscLiniiMm ?? 0) >= minimalnaLinia, `interlinia mniejsza od czcionki: ${element.tekst}`)
  })

  // Pozycje zgodne z Wordem (± 3 mm): wcześniej tekst zaczynał się ~70 mm wyżej, bo puste akapity były pomijane.
  blisko(tekst('IMIĘ I NAZWISKO').pozycja.y, 104.3, 3, 'imię i nazwisko')
  blisko(tekst('Data szkolenia').pozycja.y, 170.6, 3, 'data szkolenia')
  blisko(tekst('Wymiar szkolenia').pozycja.y - tekst('Data szkolenia').pozycja.y, 10.1, 0.5, 'odstęp wierszy 14 pt')
})

await sprawdz('certyfikat FE: placeholdery pokrywają pola wzoru, „miejsce na pieczęć” nie jest lokalizacją', () => {
  const szablon = utworzSzablonRoboczyZDokumentu(dokument, 'DOCX', 'test')
  const nazwy = new Set(szablon.placeholdery.map((placeholder) => placeholder.nazwa))

  for (const nazwa of ['uczestnik.imie_nazwisko', 'szkolenie.tytul', 'szkolenie.data', 'szkolenie.liczba_godzin', 'szkolenie.trener']) {
    assert.ok(nazwy.has(nazwa), `brak placeholdera ${nazwa}`)
  }

  assert.ok(!nazwy.has('szkolenie.miejsce'), '„Miejsce na nazwę firmy lub pieczęć” nie może być lokalizacją szkolenia')
  assert.equal(szablon.typDokumentu, 'Certyfikat')
})

