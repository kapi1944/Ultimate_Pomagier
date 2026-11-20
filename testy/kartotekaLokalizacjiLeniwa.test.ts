import assert from 'node:assert/strict'
import test from 'node:test'

const magazyn = new Map<string, string>()
globalThis.localStorage = {
  getItem: (klucz: string) => magazyn.get(klucz) ?? null,
  setItem: (klucz: string, wartosc: string) => { magazyn.set(klucz, wartosc) },
  removeItem: (klucz: string) => { magazyn.delete(klucz) },
  clear: () => magazyn.clear(),
  key: () => null,
  length: 0,
} as Storage

const kluczLokalizacji = 'ultimate-pomagier.kartoteki.lokalizacje'
const { importujLokalizacjeZCsv } = await import('../src/kartoteki/lokalizacje/importerLokalizacji.ts')
const kartoteka = await import('../src/kartoteki/lokalizacje/magazynLokalizacji.ts')

const naglowek = 'klucz_lokalizacji,nazwa,wojewodztwo,rodzaj,gmina,powiat,miejscownik_pelny_auto,status_odmiany'

test('parser CSV: wiersze z cudzysłowami, podwojonymi cudzysłowami, BOM i CRLF dają ten sam wynik co wiersze proste', () => {
  const csv = [
    `\uFEFF${naglowek}`,
    'a_1,Abisynia,kujawsko-pomorskie,część wsi,Kcynia,nakielski,Abisynii,false',
    'b_2,"Nowa, Wieś",lubelskie,"wieś ""stara""",Leśna,bialski,"Nowej, Wsi",true',
    'c_3,  Spacje ,mazowieckie,wieś,Gmina,Powiat,Spacjach,TRUE',
    '',
  ].join('\r\n')
  const wynik = importujLokalizacjeZCsv(csv)
  assert.deepEqual(wynik.bledy, [])
  assert.deepEqual(wynik.lokalizacje.map((l) => [l.klucz_lokalizacji, l.nazwa, l.rodzaj, l.miejscownik_pelny_auto, l.status_odmiany]), [
    ['a_1', 'Abisynia', 'część wsi', 'Abisynii', false],
    ['b_2', 'Nowa, Wieś', 'wieś "stara"', 'Nowej, Wsi', true],
    ['c_3', 'Spacje', 'wieś', 'Spacjach', true],
  ])
})

test('parser CSV: błędy walidacji zachowują numery wierszy', () => {
  const wynik = importujLokalizacjeZCsv([naglowek, 'a,Nazwa,w,r,g,p,M,false', ',Brak klucza,w,r,g,p,M,false', 'a,Duplikat,w,r,g,p,M,false', 'd,Brak,w,r,g,p,,false', 'e,Status,w,r,g,p,M,może'].join('\n'))
  assert.deepEqual(wynik.bledy.map((blad) => blad.wiersz), [3, 4, 5, 6])
  assert.equal(wynik.lokalizacje.length, 2)
})

test('kartoteka startowa jest budowana przy pierwszym użyciu i ma stabilną zawartość', () => {
  const pierwsza = kartoteka.pobierzLokalizacjeStartowe()
  assert.ok(pierwsza.length > 70000)
  assert.equal(kartoteka.pobierzLokalizacjeStartowe(), pierwsza)
  assert.deepEqual(kartoteka.pobierzBledyImportuStartowego(), [])
  kartoteka.rozgrzejKartotekeLokalizacji()
  assert.equal(kartoteka.pobierzLokalizacjeStartowe(), pierwsza)
})

test('scalona lista jest pamiętana dla tego samego zapisu i odświeżana po każdej zmianie zapisu', () => {
  magazyn.clear()
  const startowa = kartoteka.pobierzLokalizacjeStartowe()
  const pierwsza = kartoteka.pobierzLokalizacjeZMagazynu()
  assert.equal(pierwsza.length, startowa.length)
  assert.equal(kartoteka.pobierzLokalizacjeZMagazynu(), pierwsza, 'ten sam zapis powinien zwracać tę samą listę')

  const wzor = startowa[0]
  const potwierdzona = kartoteka.ustawPotwierdzonyMiejscownikLokalizacji(wzor.klucz_lokalizacji, ' Nowym Miejscowniku ')
  assert.equal(potwierdzona?.miejscownik_pelny_auto, 'Nowym Miejscowniku')
  assert.equal(potwierdzona?.status_odmiany, true)

  const poZmianie = kartoteka.pobierzLokalizacjeZMagazynu()
  assert.notEqual(poZmianie, pierwsza)
  assert.equal(poZmianie.length, startowa.length)
  assert.equal(kartoteka.znajdzLokalizacjePoKluczu(wzor.klucz_lokalizacji, poZmianie)?.miejscownik_pelny_auto, 'Nowym Miejscowniku')
  assert.equal(startowa[0].miejscownik_pelny_auto, wzor.miejscownik_pelny_auto, 'dane startowe nie mogą być modyfikowane')
  assert.deepEqual(kartoteka.pobierzPotwierdzonyMiejscownikLokalizacji(wzor.klucz_lokalizacji), { miejscownik: 'Nowym Miejscowniku', blad: null })

  const zapisane = JSON.parse(magazyn.get(kluczLokalizacji) ?? '[]') as unknown[]
  assert.equal(zapisane.length, 1, 'w localStorage trwają tylko różnice względem kartoteki startowej')
})

test('zmiana zapisu z innego okna oraz nowa lokalizacja użytkownika są widoczne w scalonej liście', () => {
  magazyn.clear()
  const przed = kartoteka.pobierzLokalizacjeZMagazynu()
  magazyn.set(kluczLokalizacji, JSON.stringify([{ klucz_lokalizacji: 'wlasna_1', nazwa: 'Własna Wieś', miejscownik_pelny_auto: 'Własnej Wsi', status_odmiany: true }]))
  const po = kartoteka.pobierzLokalizacjeZMagazynu()
  assert.notEqual(po, przed)
  assert.equal(po.length, przed.length + 1)
  assert.equal(kartoteka.znajdzLokalizacjePoKluczu('wlasna_1', po)?.nazwa, 'Własna Wieś')
  magazyn.set(kluczLokalizacji, '{uszkodzony json')
  assert.equal(kartoteka.pobierzLokalizacjeZMagazynu().length, przed.length, 'uszkodzony zapis nie może psuć kartoteki startowej')
})

test('błąd odczytu localStorage nie przerywa pracy kartoteki', () => {
  const oryginal = globalThis.localStorage.getItem
  globalThis.localStorage.getItem = () => { throw new Error('zablokowany magazyn') }
  try {
    assert.ok(kartoteka.pobierzLokalizacjeZMagazynu().length > 70000)
  } finally {
    globalThis.localStorage.getItem = oryginal
  }
})
