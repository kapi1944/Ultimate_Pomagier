import assert from 'node:assert/strict'
import test from 'node:test'
import { dodajUkladLewejSciany, policzPozycjeNaPolce, ukladLewejSciany, zbudujElewacje, znajdzStrefyElewacji } from '../src/moduly/zakupy/logika/elewacjaMagazynu'
import { normalizujLokalizacjeMapy } from '../src/moduly/zakupy/logika/mapaMagazynu'

const wynikPusty = () => dodajUkladLewejSciany([])

test('układ lewej ściany tworzy MAG › L › 5 mebli z półkami i krótkimi adresami', () => {
  const { lokalizacje, dodano, pominieto } = wynikPusty()
  assert.deepEqual(dodano, ['REG-01', 'REG-02', 'REG-03', 'REG-04', 'SZ-01'])
  assert.deepEqual(pominieto, [])
  assert.equal(lokalizacje.length, 2 + 5 + 10 + 9 + 5 + 5 + 4)
  const adresy = new Set(lokalizacje.map((lokalizacja) => lokalizacja.pelnyKod))
  for (const adres of ['MAG/L/REG-01/S1-PL-01', 'MAG/L/REG-01/S2-PL-05', 'MAG/L/REG-02/PL-09', 'MAG/L/SZ-01/PL-04']) assert.ok(adresy.has(adres), adres)
  assert.equal(new Set(lokalizacje.map((lokalizacja) => lokalizacja.id)).size, lokalizacje.length)
  assert.doesNotThrow(() => normalizujLokalizacjeMapy(JSON.parse(JSON.stringify(lokalizacje)), 2))
})

test('elewacja układa meble od lewej, półki od dołu i sekcje osobno', () => {
  const { lokalizacje, strefaId } = wynikPusty()
  assert.deepEqual(znajdzStrefyElewacji(lokalizacje).map((strefa) => strefa.id), [strefaId])
  const meble = zbudujElewacje(lokalizacje, strefaId)
  assert.deepEqual(meble.map((mebel) => mebel.kod), ['REG-01', 'REG-02', 'REG-03', 'REG-04', 'SZ-01'])
  assert.deepEqual(meble.map((mebel) => mebel.rodzaj), ['REGAL', 'REGAL', 'REGAL', 'REGAL', 'SZAFA'])
  assert.ok(meble.every((mebel, indeks) => indeks === 0 || mebel.x >= meble[indeks - 1].x + meble[indeks - 1].szerokosc - 1e-9))
  assert.ok(meble.every((mebel) => mebel.x >= 0 && mebel.x + mebel.szerokosc <= 100 + 1e-9))
  assert.deepEqual(meble[0].sekcje.map((sekcja) => sekcja.polki.length), [5, 5])
  assert.deepEqual(meble[0].sekcje[1].polki.map((polka) => [polka.kod, polka.poziom]), [1, 2, 3, 4, 5].map((numer) => [`S2-PL-0${numer}`, numer - 1]))
  assert.equal(meble[1].liczbaPoziomow, 9)
  assert.equal(meble[4].sekcje[0].polki[0].kod, 'PL-01')
})

test('powtórne dodanie jest idempotentne i nie rusza istniejących rekordów', () => {
  const pierwszy = wynikPusty()
  const drugi = dodajUkladLewejSciany(pierwszy.lokalizacje)
  assert.equal(drugi.lokalizacje, pierwszy.lokalizacje)
  assert.deepEqual(drugi.dodano, [])
  assert.deepEqual(drugi.pominieto, ukladLewejSciany.map((mebel) => mebel.kod))
})

test('istniejący MAG i L są użyte ponownie, a własne meble o tym samym kodzie pominięte', () => {
  const istniejace = normalizujLokalizacjeMapy([
    { id: 'mag', kod: 'MAG', nazwa: 'Magazyn', czyAktywna: true, typ: 'OBIEKT', kolejnosc: 0 },
    { id: 'lewa', kod: 'L', nazwa: 'Lewa', czyAktywna: true, typ: 'STREFA', nadrzednaLokalizacjaId: 'mag', kolejnosc: 0 },
    { id: 'moj-regal', kod: 'REG-02', nazwa: 'Mój regał', czyAktywna: true, typ: 'REGAL', nadrzednaLokalizacjaId: 'lewa', kolejnosc: 0 },
  ], 2)
  const wynik = dodajUkladLewejSciany(istniejace)
  assert.equal(wynik.strefaId, 'lewa')
  assert.deepEqual(wynik.pominieto, ['REG-02'])
  assert.equal(wynik.lokalizacje.filter((lokalizacja) => lokalizacja.kod === 'MAG').length, 1)
  assert.equal(wynik.lokalizacje.find((lokalizacja) => lokalizacja.id === 'moj-regal')?.nazwa, 'Mój regał')
  assert.deepEqual(wynik.lokalizacje.slice(0, 3), istniejace)
})

test('wygląd mebla i numer sekcji są walidowane', () => {
  const baza = { id: 'a', kod: 'A', nazwa: 'A', czyAktywna: true, typ: 'REGAL', kolejnosc: 0 }
  assert.doesNotThrow(() => normalizujLokalizacjeMapy([{ ...baza, wyglad: { rodzaj: 'SZAFA', sekcje: 2 }, sekcja: 1 }], 2))
  for (const zly of [{ wyglad: { rodzaj: 'INNY', sekcje: 1 } }, { wyglad: { rodzaj: 'REGAL', sekcje: 0 } }, { wyglad: null }, { sekcja: 0 }, { sekcja: 1.5 }]) {
    assert.throws(() => normalizujLokalizacjeMapy([{ ...baza, ...zly }], 2), /wygląd|sekcji/i)
  }
})

test('licznik pozycji na półce pomija zerowe stany', () => {
  const stany = [
    { id: '1', produktId: 'p', lokalizacjaId: 'x', ilosc: 3 }, { id: '2', produktId: 'q', lokalizacjaId: 'x', ilosc: 0 }, { id: '3', produktId: 'p', lokalizacjaId: 'y', ilosc: 1 },
  ]
  assert.equal(policzPozycjeNaPolce(stany, 'x'), 1)
})
