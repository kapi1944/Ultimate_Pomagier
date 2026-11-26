import assert from 'node:assert/strict'
import test from 'node:test'
import type { Lokalizacja } from '../src/kartoteki/lokalizacje/typyLokalizacji.ts'
import { brakPodpowiedziMiejscowosci } from '../src/kartoteki/lokalizacje/wyszukiwanieMiejscowosci.ts'
import { zbudujIndeksLokalizacjiSzczegolow, pobierzNazweZMiejsca } from '../src/moduly/zamkniete/szczegoly_organizacyjne/uslugi/indeksLokalizacjiSzczegolow.ts'

function lokalizacja(nazwa: string, klucz = nazwa): Lokalizacja {
  return { nazwa, klucz_lokalizacji: klucz, wojewodztwo: '', rodzaj: '', gmina: '', powiat: '', miejscownik_pelny_auto: '', status_odmiany: false }
}

test('nazwa miejscowości jest wyciągana z samego miasta oraz z końca adresu z kodem pocztowym', () => {
  assert.equal(pobierzNazweZMiejsca(' ŁÓDŹ '), 'łódź')
  assert.equal(pobierzNazweZMiejsca('Hotel Bulwary, ul. Rzeczna 8, 39-300 Mielec'), 'mielec')
  assert.equal(pobierzNazweZMiejsca(''), '')
})

test('indeks zachowuje polskie znaki, adres z kodem i jednoznaczność dopasowania', () => {
  const lodz = lokalizacja('Łódź')
  const mielec = lokalizacja('Mielec')
  const indeks = zbudujIndeksLokalizacjiSzczegolow([lodz, mielec, lokalizacja('Brzeziny', 'a'), lokalizacja('BRZEZINY', 'b')])
  assert.deepEqual(indeks.znajdz(' ŁÓDŹ '), lodz)
  assert.deepEqual(indeks.znajdz('Hotel Bulwary, ul. Rzeczna 8, 39-300 Mielec'), mielec)
  assert.deepEqual(indeks.znajdz('Mielcu'), null)
  assert.deepEqual(indeks.znajdz('Lodz'), null)
  assert.deepEqual(indeks.znajdz('Brzeziny'), null)
  assert.deepEqual(indeks.znajdz(''), null)
})

test('podpowiedzi indeksu pochodzą z podanego źródła nazw (najpierw początek, potem zawieranie)', () => {
  const zrodlo = (fraza: string) => (fraza === 'do' ? { poczatek: ['Dobkowice'], zawierajace: ['Wadowice'] } : brakPodpowiedziMiejscowosci)
  const indeks = zbudujIndeksLokalizacjiSzczegolow([], null, zrodlo)
  assert.deepEqual(indeks.podpowiedz('do'), { poczatek: ['Dobkowice'], zawierajace: ['Wadowice'] })
  assert.deepEqual(indeks.podpowiedz('x'), brakPodpowiedziMiejscowosci)
})

test('odświeżony indeks uwzględnia potwierdzenie odmiany i nowe lokalizacje, a stary pozostaje niezmieniony', () => {
  const przed = lokalizacja('Łódź')
  const po = { ...przed, miejscownik_pelny_auto: 'Łodzi', status_odmiany: true }
  const staryIndeks = zbudujIndeksLokalizacjiSzczegolow([przed])
  const nowyIndeks = zbudujIndeksLokalizacjiSzczegolow([po, lokalizacja('Mielec')])
  assert.equal(staryIndeks.znajdz('Łódź')?.status_odmiany, false)
  assert.equal(nowyIndeks.znajdz('Łódź')?.status_odmiany, true)
  assert.equal(nowyIndeks.znajdz('Łódź')?.miejscownik_pelny_auto, 'Łodzi')
  assert.equal(nowyIndeks.znajdz('Mielec')?.nazwa, 'Mielec')
})

test('pusta nazwa w kartotece nie dopasowuje pustego pola formularza', () => {
  const lokalizacje = [lokalizacja(''), lokalizacja('Łódź'), lokalizacja('Brzeziny', 'a'), lokalizacja('BRZEZINY', 'b')]
  const indeks = zbudujIndeksLokalizacjiSzczegolow(lokalizacje)
  for (const miejsce of ['', ' ', 'Brzeziny', 'Nieznane', 'Lodz']) assert.equal(indeks.znajdz(miejsce), null, miejsce)
  assert.deepEqual(indeks.znajdz('90-001 Łódź'), lokalizacje[1])
})
