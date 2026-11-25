import assert from 'node:assert/strict'
import test from 'node:test'
import { poczatkoweDaneFormularza } from '../src/moduly/zamkniete/szczegoly_organizacyjne/danePoczatkowe.ts'
import {
  pobierzAutosaveSzczegolow,
  usunAutosaveSzczegolow,
  wykonajOczekujaceAutosaveSzczegolow,
  zapiszAutosaveSzczegolowOdroczony,
} from '../src/moduly/zamkniete/szczegoly_organizacyjne/uslugi/magazynWersjiRoboczych.ts'

const magazyn = new Map<string, string>()
let liczbaZapisow = 0

globalThis.localStorage = {
  getItem: (klucz: string) => magazyn.get(klucz) ?? null,
  setItem: (klucz: string, wartosc: string) => { liczbaZapisow += 1; magazyn.set(klucz, wartosc) },
  removeItem: (klucz: string) => magazyn.delete(klucz),
  clear: () => magazyn.clear(),
  key: () => null,
  length: 0,
} as Storage

const adresaci = { reczniAdresaci: '', trybTresci: 'Tylko zmiany' as const, czyPodpis: true, wiadomoscWlasna: '' }

function autosave(tytul: string, instancja = 'instancja-a') {
  return { id: `autosave-${tytul}`, identyfikatorInstancji: instancja, dataZapisu: '2026-11-25T10:00:00.000Z', dane: { ...poczatkoweDaneFormularza, tytulSzkolenia: tytul }, grupy: [], adresaci, statusyPol: {} }
}

const poczekaj = (ms: number) => new Promise((rozwiaz) => setTimeout(rozwiaz, ms))

test('seria zmian daje jeden zapis z ostatnimi danymi, a odczyt widzi dane oczekujące na zapis', async () => {
  magazyn.clear()
  liczbaZapisow = 0
  for (const tytul of ['A', 'AB', 'ABC']) zapiszAutosaveSzczegolowOdroczony(autosave(tytul))
  assert.equal(liczbaZapisow, 0, 'nic nie jest zapisywane synchronicznie')
  assert.equal(pobierzAutosaveSzczegolow('instancja-a')?.dane.tytulSzkolenia, 'ABC')
  await poczekaj(900)
  assert.equal(liczbaZapisow, 2, 'jeden zapis = klucz instancji + wskaźnik zgodności wstecznej')
  assert.equal(JSON.parse(magazyn.get('ultimatePomagier.szczegolyOrganizacyjne.autosave.instancja-a') ?? 'null')?.dane.tytulSzkolenia, 'ABC')
  usunAutosaveSzczegolow('instancja-a')
})

test('wyjście z widoku zapisuje oczekujące dane natychmiast', () => {
  magazyn.clear()
  zapiszAutosaveSzczegolowOdroczony(autosave('Przy wyjściu', 'instancja-b'))
  wykonajOczekujaceAutosaveSzczegolow()
  assert.equal(pobierzAutosaveSzczegolow('instancja-b')?.dane.tytulSzkolenia, 'Przy wyjściu')
  assert.ok([...magazyn.keys()].some((klucz) => klucz.endsWith('instancja-b')), 'dane trafiły do localStorage')
  usunAutosaveSzczegolow('instancja-b')
})

test('usunięcie autosave anuluje oczekujący zapis, więc zapisana wersja nie odtwarza starego szkicu', async () => {
  magazyn.clear()
  liczbaZapisow = 0
  zapiszAutosaveSzczegolowOdroczony(autosave('Po zapisie', 'instancja-c'))
  usunAutosaveSzczegolow('instancja-c')
  await poczekaj(900)
  assert.equal(liczbaZapisow, 0)
  assert.equal(pobierzAutosaveSzczegolow('instancja-c'), null)
})

test('błąd odroczonego zapisu jest zgłaszany przez callback, a nie gubiony', async () => {
  magazyn.clear()
  const oryginal = globalThis.localStorage.setItem
  globalThis.localStorage.setItem = () => { throw new Error('brak miejsca') }
  let zgloszono = 0
  try {
    zapiszAutosaveSzczegolowOdroczony(autosave('Błąd', 'instancja-d'), () => { zgloszono += 1 })
    await poczekaj(900)
  } finally {
    globalThis.localStorage.setItem = oryginal
  }
  assert.equal(zgloszono, 1)
  assert.equal(pobierzAutosaveSzczegolow('instancja-d'), null, 'nieudany zapis nie zostaje jako oczekujący')
})
