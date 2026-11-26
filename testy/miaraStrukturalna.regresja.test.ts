import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DOMParser } from '@xmldom/xmldom'
import type { DokumentPomagiera, ElementTekstowyDokumentu } from '../src/wspolne/dokumenty/typyDokumentu.ts'

;(globalThis as unknown as { DOMParser: unknown }).DOMParser ??= DOMParser

const { importujDokumentDocx } = await import('../src/wspolne/import/importujDokumentDocx.ts')
const { zliczNieobsluzoneWezlyDocx } = await import('../src/wspolne/import/ukladDocx.ts')
const { utworzSzablonRoboczyZDokumentu } = await import('../src/moduly/dokumenty/replikator_dokumentow/parserDocxReplikatora.ts')
const { policzMiareStrukturalna } = await import('../src/moduly/dokumenty/replikator_dokumentow/miaraStrukturalna.ts')

async function sprawdz(nazwa: string, test: () => Promise<void> | void) {
  await test()
  console.log(`OK: ${nazwa}`)
}

const dokument = await importujDokumentDocx(new File([readFileSync(new URL('./fixtures/FE_certyfikat_COP_pion.docx', import.meta.url))], 'FE_certyfikat_COP_pion.docx'))

await sprawdz('miara: wzorzec FE ma geometrię z XML, brak kolizji i wysoki wynik strukturalny', () => {
  const miara = policzMiareStrukturalna(dokument)

  assert.equal(dokument.metadane.zrodloGeometrii, 'xml')
  assert.equal(miara.odsetekGeometriiZXml, 100)
  assert.deepEqual(miara.kolizje, [])
  assert.ok(miara.procent >= 90, `procent strukturalny: ${miara.procent}`)
  assert.deepEqual(miara.elementyDoPoprawy, Object.entries(miara.nieobsluzoneWezly).map(([etykieta, liczba]) => `Nieodtworzone w układzie: ${etykieta} × ${liczba}.`))
})

await sprawdz('miara: nakładające się teksty obniżają wynik i są wskazane z nazwy', () => {
  const teksty = dokument.strony[0].elementy.filter((element): element is ElementTekstowyDokumentu => element.rodzaj === 'tekst')
  const [pierwszy, drugi] = teksty
  const zKolizja: DokumentPomagiera = {
    ...dokument,
    strony: [{ ...dokument.strony[0], elementy: dokument.strony[0].elementy.map((element) => (element.id === drugi.id ? { ...drugi, pozycja: { ...drugi.pozycja, y: pierwszy.pozycja.y + 2 } } : element)) }],
  }
  const miara = policzMiareStrukturalna(zKolizja)

  assert.equal(miara.kolizje.length, 1)
  assert.ok(miara.procent < policzMiareStrukturalna(dokument).procent)
  assert.ok(miara.elementyDoPoprawy[0].includes(pierwszy.tekst) && miara.elementyDoPoprawy[0].includes(drugi.tekst))
})

await sprawdz('miara: geometria spoza XML ogranicza wynik do 60% i jest zgłoszona', () => {
  const miara = policzMiareStrukturalna({ ...dokument, metadane: { ...dokument.metadane, zrodloGeometrii: 'domyslna' } })
  const starszyZapis = policzMiareStrukturalna({ ...dokument, metadane: { ...dokument.metadane, zrodloGeometrii: undefined } })

  assert.equal(miara.odsetekGeometriiZXml, 0)
  assert.ok(miara.procent <= 60)
  assert.equal(starszyZapis.procent, miara.procent, 'brak informacji o źródle = ostrożnie jak geometria domyślna')
  assert.ok(miara.elementyDoPoprawy.some((pozycja) => pozycja.includes('wartości domyślnych')))
})

await sprawdz('miara: nieobsłużone konstrukcje DOCX są liczone z nazwy i obniżają wynik', () => {
  const xml = `<w:body xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:shd w:fill="DDDDDD"/><w:pBdr><w:top w:val="single"/></w:pBdr></w:pPr><w:r><w:t>punkt</w:t></w:r></w:p>
    <w:p><w:r><w:pict/></w:r><w:r><w:txbxContent/></w:r><wps:wsp/></w:p>
    <w:p><w:pPr><w:sectPr/></w:pPr></w:p>
    <w:sectPr/></w:body>`
  const body = new DOMParser().parseFromString(xml, 'text/xml').documentElement as unknown as Element
  const wezly = zliczNieobsluzoneWezlyDocx(body)

  assert.deepEqual(wezly, {
    'pola tekstowe (txbx)': 1,
    'obiekty VML (pict)': 1,
    'kształty DrawingML (wsp)': 1,
    'numeracja i punktory (numPr)': 1,
    'obramowania akapitów (pBdr)': 1,
    'cieniowanie akapitów (shd)': 1,
    'dodatkowe sekcje (sectPr w akapicie)': 1,
  })

  const miara = policzMiareStrukturalna({ ...dokument, metadane: { ...dokument.metadane, nieobsluzoneWezlyDocx: wezly } })

  assert.equal(miara.liczbaNieobsluzonychWezlow, 7)
  assert.ok(miara.procent <= 100 - 7 * 4)
  assert.ok(miara.elementyDoPoprawy.some((pozycja) => pozycja.includes('numeracja i punktory (numPr) × 1')))
})

await sprawdz('raport: wynik zgodności nie przekracza miary strukturalnej, opis podaje składniki', () => {
  const zKolizja: DokumentPomagiera = {
    ...dokument,
    metadane: { ...dokument.metadane, nieobsluzoneWezlyDocx: { 'pola tekstowe (txbx)': 5 } },
  }
  const szablon = utworzSzablonRoboczyZDokumentu(zKolizja, 'DOCX', 'Tester', [], [])
  const miara = policzMiareStrukturalna(zKolizja)

  assert.ok(szablon.procentZgodnosci <= miara.procent)
  assert.ok(szablon.procentZgodnosci < utworzSzablonRoboczyZDokumentu(dokument, 'DOCX', 'Tester', [], []).procentZgodnosci)
  assert.match(szablon.raportImportu.opisHeurystyki, /Miara strukturalna/)
  assert.ok(szablon.raportImportu.wymagaPoprawy.some((pozycja) => pozycja.includes('pola tekstowe (txbx) × 5')))
})
