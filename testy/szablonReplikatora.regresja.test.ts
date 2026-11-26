import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DOMParser } from '@xmldom/xmldom'
import type { DokumentPomagiera, ElementDokumentu, ElementTekstowyDokumentu } from '../src/wspolne/dokumenty/typyDokumentu.ts'

;(globalThis as unknown as { DOMParser: unknown }).DOMParser ??= DOMParser

// Prosty localStorage z limitem rozmiaru (symulacja przekroczenia miejsca).
const magazyn = new Map<string, string>()
let limitZnakow = Infinity
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (klucz: string) => magazyn.get(klucz) ?? null,
  setItem: (klucz: string, wartosc: string) => {
    if (wartosc.length > limitZnakow) throw new DOMException('Pełny magazyn', 'QuotaExceededError')
    magazyn.set(klucz, wartosc)
  },
  removeItem: (klucz: string) => void magazyn.delete(klucz),
  clear: () => magazyn.clear(),
  key: () => null,
  length: 0,
} as Storage

const { importujDokumentDocx } = await import('../src/wspolne/import/importujDokumentDocx.ts')
const { utworzSzablonRoboczyZDokumentu } = await import('../src/moduly/dokumenty/replikator_dokumentow/parserDocxReplikatora.ts')
const { zastosujPlaceholderyWDokumencie, wygenerujDokumentyZSzablonu, podstawPlaceholderWTekscie, formatujDatyDlaSzablonu, odmienLiczbeStron } = await import('../src/moduly/dokumenty/replikator_dokumentow/szablonReplikatora.ts')
const magazynSzablonow = await import('../src/kartoteki/szablony_dokumentow/magazynSzablonowDokumentow.ts')
const { zbudujDaneSeryjnychDyplomow } = await import('../src/moduly/dokumenty/generatory/dyplomy/modelSeryjnychDyplomow.ts')

async function sprawdz(nazwa: string, test: () => Promise<void> | void) {
  await test()
  console.log(`OK: ${nazwa}`)
}

const splaszcz = (elementy: ElementDokumentu[]): ElementDokumentu[] => elementy.flatMap((element) => (element.rodzaj === 'blok' ? splaszcz(element.elementy) : [element]))
const teksty = (dokument: DokumentPomagiera) => splaszcz(dokument.strony[0].elementy).filter((element): element is ElementTekstowyDokumentu => element.rodzaj === 'tekst')
const dolny = (element: ElementTekstowyDokumentu) => element.pozycja.y + element.pozycja.wysokosc
const nakladaSie = (a: ElementTekstowyDokumentu, b: ElementTekstowyDokumentu) =>
  a.pozycja.x < b.pozycja.x + b.pozycja.szerokosc && b.pozycja.x < a.pozycja.x + a.pozycja.szerokosc && a.pozycja.y < dolny(b) - 0.01 && b.pozycja.y < dolny(a) - 0.01
const znajdzKolizje = (dokument: DokumentPomagiera) => {
  const lista = teksty(dokument)
  return lista.flatMap((a, i) => lista.slice(i + 1).filter((b) => nakladaSie(a, b)).map((b) => `${a.tekst} × ${b.tekst}`))
}

const dokumentZrodlowy = await importujDokumentDocx(new File([readFileSync(new URL('./fixtures/FE_certyfikat_COP_pion.docx', import.meta.url))], 'FE_certyfikat_COP_pion.docx'))
const szablonRoboczy = utworzSzablonRoboczyZDokumentu(dokumentZrodlowy, 'DOCX', 'Tester', [], [])

const kontekst = {
  zrodlo: { szczegolyOrganizacyjneId: 's1', wersjaSzczegolowId: null, zmodyfikowano: '2026-09-04', odciskDanych: 't' },
  szkolenie: { id: 'sz1', tytul: 'Prawo zamówień publicznych dla zaawansowanych – kompleksowe przygotowanie postępowań oraz kontrola ich przebiegu i rozliczenie umów', typ: null, tryb: null, liczbaGodzin: 16 },
  organizator: { id: 'iist', nazwa: 'IIST', marka: 'IIST', logoId: null, logoNazwaPliku: null, logoPodglad: null },
  klient: { id: 'k1', nazwa: 'Klient', nip: null, adres: null, osobaKontaktowa: null },
  trenerzy: [],
  grupy: [{ id: 'g1', nazwa: 'Grupa A', daty: ['2026-10-01', '2026-10-02'], tryb: 'Stacjonarne', liczbaGodzin: 16, lokalizacje: [], trenerzy: [{ id: 't1', imieINazwisko: 'Jan Nowak' }], uczestnicy: [{ id: 'u1', imie: 'Anna', nazwisko: 'Kowalska', nazwaPelna: 'Anna Kowalska', email: null, stanowisko: null }, { id: 'u2', imie: 'Piotr', nazwisko: 'Nowak-Jeziorański', nazwaPelna: 'Piotr Nowak-Jeziorański', email: null, stanowisko: null }], liczbaUczestnikow: 2, wysylkaMaterialow: { wymagana: null, odbiorca: null, adres: null, uwagi: null } }],
  uwagi: null,
}

await sprawdz('placeholdery: tryby podstawienia (całość vs etykieta + wartość)', () => {
  assert.equal(podstawPlaceholderWTekscie('IMIĘ I NAZWISKO', 'uczestnik.imie_nazwisko'), '{{uczestnik.imie_nazwisko}}')
  assert.equal(podstawPlaceholderWTekscie('Data szkolenia: 12.05.2026', 'szkolenie.data'), 'Data szkolenia: {{szkolenie.data}}')
  assert.equal(podstawPlaceholderWTekscie('Data szkolenia:', 'szkolenie.data'), 'Data szkolenia: {{szkolenie.data}}')
  assert.equal(podstawPlaceholderWTekscie('Data szkolenia: 12.05.2026', 'szkolenie.data', 'zastap_calosc'), '{{szkolenie.data}}')
  assert.equal(formatujDatyDlaSzablonu(['2026-10-02', '2026-10-01']), '01, 02.10.2026')
  assert.equal(formatujDatyDlaSzablonu(['2026-10-01']), '01.10.2026')
})

await sprawdz('szablon: niezatwierdzone placeholdery nie zmieniają treści, zatwierdzone zastępują tekst z zachowaniem pozycji i stylu', () => {
  const bezZmian = zastosujPlaceholderyWDokumencie(dokumentZrodlowy, szablonRoboczy.placeholdery)
  assert.deepEqual(teksty(bezZmian).map((element) => element.tekst), teksty(dokumentZrodlowy).map((element) => element.tekst))

  const zatwierdzone = szablonRoboczy.placeholdery.map((placeholder) => ({ ...placeholder, status: 'zatwierdzony' as const }))
  const zPlaceholderami = zastosujPlaceholderyWDokumencie(dokumentZrodlowy, zatwierdzone)
  const imie = teksty(zPlaceholderami).find((element) => element.tekst === '{{uczestnik.imie_nazwisko}}')
  const imieZrodlo = teksty(dokumentZrodlowy).find((element) => element.tekst === 'IMIĘ I NAZWISKO')

  assert.ok(imie && imieZrodlo)
  assert.deepEqual(imie.pozycja, imieZrodlo.pozycja)
  assert.deepEqual(imie.styl, imieZrodlo.styl)
  assert.equal(imie.status, 'dynamiczny')
  assert.ok(zPlaceholderami.polaDynamiczne.some((pole) => pole.elementId === imie.id && pole.nazwa === 'uczestnik.imie_nazwisko'))
  assert.ok(teksty(zPlaceholderami).some((element) => element.tekst === 'Miejsce na nazwę firmy lub pieczęć'), 'miejsce na pieczęć pozostaje stałe')
})

const zatwierdzone = szablonRoboczy.placeholdery.map((placeholder) => ({ ...placeholder, status: 'zatwierdzony' as const }))
const dokumentSzablonu = zastosujPlaceholderyWDokumencie(dokumentZrodlowy, zatwierdzone)
const szablonDoZapisu = { ...szablonRoboczy, placeholdery: zatwierdzone, dokumentPodgladu: dokumentSzablonu }

await sprawdz('szablon: zapis w Kartotece, ponowne wczytanie i deduplikacja obrazów', () => {
  const zapisany = magazynSzablonow.zapiszNowySzablonZReplikatora(szablonDoZapisu, dokumentSzablonu, 'Tester', 'Certyfikat FE')
  const surowy = magazyn.get(magazynSzablonow.kluczMagazynuSzablonowDokumentow) ?? ''
  const obrazyWSurowym = splaszcz((JSON.parse(surowy)[0].dokumentPodgladu as DokumentPomagiera).strony.flatMap((strona) => strona.elementy)).filter((element) => element.rodzaj === 'obraz')

  assert.ok(obrazyWSurowym.length > 0)
  assert.ok(obrazyWSurowym.every((obraz) => !('zrodlo' in obraz) || !obraz.zrodlo), 'obraz zapisany raz – w zasobach, nie w elemencie')

  const wczytany = magazynSzablonow.pobierzSzablonDokumentuPoId(zapisany.id)
  assert.ok(wczytany?.dokumentPodgladu)
  assert.equal(wczytany.typDokumentu, 'Certyfikat')
  assert.equal(wczytany.placeholdery.filter((placeholder) => placeholder.status === 'zatwierdzony').length, zatwierdzone.length)
  splaszcz(wczytany.dokumentPodgladu.strony.flatMap((strona) => strona.elementy)).forEach((element) => {
    if (element.rodzaj === 'obraz') assert.ok(element.zrodlo?.startsWith('data:'), `obraz ${element.id} odtworzony po wczytaniu`)
  })
  assert.deepEqual(teksty(wczytany.dokumentPodgladu).map((element) => element.tekst), teksty(dokumentSzablonu).map((element) => element.tekst))
})

await sprawdz('szablon: komunikat i brak zapisu przy przekroczeniu miejsca', () => {
  const przed = magazyn.get(magazynSzablonow.kluczMagazynuSzablonowDokumentow)
  limitZnakow = 100
  try {
    assert.throws(() => magazynSzablonow.zapiszNowySzablonZReplikatora(szablonDoZapisu, dokumentSzablonu, 'Tester', 'Za duży'), (blad: unknown) =>
      blad instanceof magazynSzablonow.BladZapisuSzablonowDokumentow && blad.przyczyna === 'brak_miejsca' && /brakuje miejsca/.test(blad.message))
  } finally {
    limitZnakow = Infinity
  }
  assert.equal(magazyn.get(magazynSzablonow.kluczMagazynuSzablonowDokumentow), przed, 'poprzedni zapis nietknięty')
})

await sprawdz('generowanie: certyfikaty seryjne dla 2 uczestników, zawijanie długiego tytułu bez nakładania', () => {
  const wczytany = magazynSzablonow.pobierzSzablonyDokumentowZKartoteki()[0]
  assert.ok(wczytany.dokumentPodgladu)
  assert.deepEqual(znajdzKolizje(wczytany.dokumentPodgladu), [], 'szablon bez kolizji')

  const dane = zbudujDaneSeryjnychDyplomow(kontekst, 'g1')
  assert.ok(dane)
  const wyniki = wygenerujDokumentyZSzablonu(wczytany.dokumentPodgladu, dane, dane.uczestnicy)

  assert.equal(wyniki.length, 2)
  assert.notEqual(wyniki[0].dokument.id, wyniki[1].dokument.id)
  wyniki.forEach(({ uczestnik, dokument }) => {
    const lista = teksty(dokument)
    const tekstyDokumentu = lista.map((element) => element.tekst)

    assert.ok(tekstyDokumentu.includes(uczestnik))
    assert.ok(tekstyDokumentu.includes(dane.tytulSzkolenia))
    assert.ok(tekstyDokumentu.includes('01, 02.10.2026'))
    assert.ok(tekstyDokumentu.includes('16 godz.'))
    assert.ok(tekstyDokumentu.includes('Jan Nowak'))
    assert.ok(!tekstyDokumentu.some((tekst) => tekst.includes('{{')), 'żaden placeholder nie został w dokumencie')
    assert.deepEqual(znajdzKolizje(dokument), [], `brak nakładania elementów: ${uczestnik}`)
    assert.equal(dokument.polaDynamiczne.length, 0)
  })

  const szablonTytul = teksty(wczytany.dokumentPodgladu).find((element) => element.tekst === '{{szkolenie.tytul}}')
  const tytul = teksty(wyniki[0].dokument).find((element) => element.tekst === dane.tytulSzkolenia)
  const dataSzablon = teksty(wczytany.dokumentPodgladu).find((element) => element.tekst === '{{szkolenie.data}}')
  const dataWynik = teksty(wyniki[0].dokument).find((element) => element.tekst === '01, 02.10.2026')

  assert.ok(szablonTytul && tytul && dataSzablon && dataWynik)
  assert.ok(tytul.pozycja.wysokosc > szablonTytul.pozycja.wysokosc, 'długi tytuł zajmuje więcej wierszy')
  assert.equal(tytul.pozycja.szerokosc, szablonTytul.pozycja.szerokosc, 'zawijanie w obrębie pola – szerokość bez zmian')
  assert.equal(dataWynik.pozycja.x, dataSzablon.pozycja.x)
  assert.ok(dataWynik.pozycja.y >= dolny(tytul) - 0.01, 'kolejny element przesunięty tylko tak, by nie nachodzić')
  assert.equal(teksty(wyniki[0].dokument).find((element) => element.tekst === wyniki[0].uczestnik)?.pozycja.y, teksty(wczytany.dokumentPodgladu).find((element) => element.tekst === '{{uczestnik.imie_nazwisko}}')?.pozycja.y, 'elementy nad tytułem nie przesuwają się')
})

await sprawdz('generowanie: krótki tytuł nie przesuwa kolejnych elementów', () => {
  const wczytany = magazynSzablonow.pobierzSzablonyDokumentowZKartoteki()[0]
  assert.ok(wczytany.dokumentPodgladu)
  const [wynik] = wygenerujDokumentyZSzablonu(wczytany.dokumentPodgladu, { tytulSzkolenia: 'BHP', trener: 'Jan Nowak', liczbaGodzin: 8, daty: ['2026-10-01'] }, ['Anna Kowalska'])
  const przed = teksty(wczytany.dokumentPodgladu).map((element) => element.pozycja.y)
  const po = teksty(wynik.dokument).map((element) => element.pozycja.y)

  assert.deepEqual(po, przed)
})

await sprawdz('UI: odmiana „strona/strony/stron”', () => {
  assert.deepEqual([1, 2, 4, 5, 12, 14, 22, 25].map(odmienLiczbeStron), ['1 strona', '2 strony', '4 strony', '5 stron', '12 stron', '14 stron', '22 strony', '25 stron'])
})
