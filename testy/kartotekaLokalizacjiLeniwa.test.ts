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
const ladowanie = await import('../src/kartoteki/lokalizacje/ladowanieKatalogu.ts')
const { zrodloKataloguZDysku } = await import('./zrodloKataloguLokalizacji.ts')

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

test('zmiany użytkownika są zapisywane jako różnice względem katalogu i nie modyfikują danych startowych', async () => {
  magazyn.clear()
  ladowanie.ustawZrodloKataloguLokalizacji(zrodloKataloguZDysku)
  await ladowanie.zaladujCalyKatalogLokalizacji()
  const startowa = ladowanie.pobierzZaladowaneLokalizacjeStartowe()
  const pierwsza = kartoteka.pobierzLokalizacjeZMagazynu()
  assert.equal(pierwsza, startowa, 'bez zmian użytkownika zwracana jest współdzielona lista startowa')
  assert.equal(kartoteka.pobierzLokalizacjeZMagazynu(), pierwsza, 'ten sam zapis powinien zwracać tę samą listę')

  const wzor = startowa[0]
  const pierwotnyMiejscownik = wzor.miejscownik_pelny_auto
  const pierwotnyStatus = wzor.status_odmiany
  const potwierdzona = kartoteka.ustawPotwierdzonyMiejscownikLokalizacji(wzor.klucz_lokalizacji, ' Nowym Miejscowniku ')
  assert.equal(potwierdzona?.miejscownik_pelny_auto, 'Nowym Miejscowniku')
  assert.equal(potwierdzona?.status_odmiany, true)

  const poZmianie = kartoteka.pobierzLokalizacjeZMagazynu()
  assert.notEqual(poZmianie, pierwsza)
  assert.equal(poZmianie.length, startowa.length)
  assert.equal(kartoteka.znajdzLokalizacjePoKluczu(wzor.klucz_lokalizacji, poZmianie)?.miejscownik_pelny_auto, 'Nowym Miejscowniku')
  assert.equal(startowa[0].miejscownik_pelny_auto, pierwotnyMiejscownik, 'dane startowe nie mogą być modyfikowane')
  assert.equal(startowa[0].status_odmiany, pierwotnyStatus, 'status danych startowych nie może być modyfikowany')
  assert.notEqual(pierwotnyMiejscownik, 'Nowym Miejscowniku')
  assert.deepEqual(kartoteka.pobierzPotwierdzonyMiejscownikLokalizacji(wzor.klucz_lokalizacji), { miejscownik: 'Nowym Miejscowniku', blad: null })

  const zapisane = JSON.parse(magazyn.get(kluczLokalizacji) ?? '[]') as Array<Record<string, unknown>>
  assert.equal(zapisane.length, 1, 'w localStorage trwają tylko różnice względem kartoteki startowej')
  assert.equal(zapisane[0].klucz_lokalizacji, wzor.klucz_lokalizacji)

  const drugaZmiana = kartoteka.ustawPotwierdzonyMiejscownikLokalizacji(wzor.klucz_lokalizacji, 'Jeszcze Inaczej')
  assert.equal(drugaZmiana?.miejscownik_pelny_auto, 'Jeszcze Inaczej')
  assert.equal((JSON.parse(magazyn.get(kluczLokalizacji) ?? '[]') as unknown[]).length, 1, 'ponowna zmiana tego samego rekordu nie dubluje wpisu')
})

test('potwierdzenie miejscownika zachowuje wcześniejsze zmiany użytkownika dla województw spoza pamięci', async () => {
  magazyn.clear()
  ladowanie.ustawZrodloKataloguLokalizacji(zrodloKataloguZDysku)
  magazyn.set(kluczLokalizacji, JSON.stringify([{ klucz_lokalizacji: 'wlasna_1', nazwa: 'Własna Wieś', miejscownik_pelny_auto: 'Własnej Wsi', status_odmiany: true }]))
  await ladowanie.zaladujLokalizacjeDlaNazw(['Dobiegniew'])
  const dobrogniew = kartoteka.pobierzLokalizacjeZMagazynu().find((lokalizacja) => lokalizacja.nazwa === 'Dobiegniew')
  assert.ok(dobrogniew)
  kartoteka.ustawPotwierdzonyMiejscownikLokalizacji(dobrogniew.klucz_lokalizacji, 'Dobiegniewie')
  const zapisane = JSON.parse(magazyn.get(kluczLokalizacji) ?? '[]') as Array<{ klucz_lokalizacji: string }>
  assert.deepEqual(zapisane.map((zmiana) => zmiana.klucz_lokalizacji).sort(), ['wlasna_1', dobrogniew.klucz_lokalizacji].sort())
  assert.equal(kartoteka.ustawPotwierdzonyMiejscownikLokalizacji('nie_ma_takiego_klucza', 'X'), null)
})

test('zapis pełnej listy z widoku kartotek zachowuje tylko różnice względem katalogu', async () => {
  magazyn.clear()
  ladowanie.ustawZrodloKataloguLokalizacji(zrodloKataloguZDysku)
  await ladowanie.zaladujCalyKatalogLokalizacji()
  const lista = kartoteka.pobierzLokalizacjeZMagazynu()
  const zmieniona = [{ ...lista[5], gmina: 'Zmieniona gmina' }, ...lista.slice(0, 5), ...lista.slice(6), { ...lista[0], klucz_lokalizacji: 'kopia_1', nazwa: `${lista[0].nazwa} kopia` }]
  kartoteka.zapiszLokalizacjeWMagazynie(zmieniona)
  const zapisane = JSON.parse(magazyn.get(kluczLokalizacji) ?? '[]') as Array<{ klucz_lokalizacji: string }>
  assert.deepEqual(zapisane.map((zmiana) => zmiana.klucz_lokalizacji).sort(), [lista[5].klucz_lokalizacji, 'kopia_1'].sort())
  assert.equal(kartoteka.pobierzLokalizacjeZMagazynu().length, lista.length + 1)
})

test('zmiana zapisu z innego okna oraz nowa lokalizacja użytkownika są widoczne w scalonej liście', async () => {
  magazyn.clear()
  ladowanie.ustawZrodloKataloguLokalizacji(zrodloKataloguZDysku)
  await ladowanie.zaladujCalyKatalogLokalizacji()
  const przed = kartoteka.pobierzLokalizacjeZMagazynu()
  magazyn.set(kluczLokalizacji, JSON.stringify([{ klucz_lokalizacji: 'wlasna_1', nazwa: 'Własna Wieś', miejscownik_pelny_auto: 'Własnej Wsi', status_odmiany: true }]))
  const po = kartoteka.pobierzLokalizacjeZMagazynu()
  assert.notEqual(po, przed)
  assert.equal(po.length, przed.length + 1)
  assert.equal(kartoteka.znajdzLokalizacjePoKluczu('wlasna_1', po)?.nazwa, 'Własna Wieś')
  magazyn.set(kluczLokalizacji, '{uszkodzony json')
  assert.equal(kartoteka.pobierzLokalizacjeZMagazynu().length, przed.length, 'uszkodzony zapis nie może psuć kartoteki startowej')
})

test('własne lokalizacje użytkownika są dostępne od razu, także zanim katalog zostanie wczytany', () => {
  magazyn.clear()
  ladowanie.ustawZrodloKataloguLokalizacji(zrodloKataloguZDysku)
  magazyn.set(kluczLokalizacji, JSON.stringify([{ klucz_lokalizacji: 'wlasna_1', nazwa: 'Własna Wieś', miejscownik_pelny_auto: 'Własnej Wsi', status_odmiany: true }]))
  const lista = kartoteka.pobierzLokalizacjeZMagazynu()
  assert.deepEqual(lista.map((lokalizacja) => lokalizacja.klucz_lokalizacji), ['wlasna_1'])
  assert.equal(kartoteka.znajdzLokalizacjeDlaMiejsca('własna wieś')?.status_odmiany, true)
})

test('błąd odczytu localStorage nie przerywa pracy kartoteki', async () => {
  magazyn.clear()
  ladowanie.ustawZrodloKataloguLokalizacji(zrodloKataloguZDysku)
  await ladowanie.zaladujCalyKatalogLokalizacji()
  const oryginal = globalThis.localStorage.getItem
  globalThis.localStorage.getItem = () => { throw new Error('zablokowany magazyn') }
  try {
    assert.ok(kartoteka.pobierzLokalizacjeZMagazynu().length > 70000)
  } finally {
    globalThis.localStorage.getItem = oryginal
  }
})
