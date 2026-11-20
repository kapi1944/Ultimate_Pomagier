import assert from 'node:assert/strict'
import test from 'node:test'
import { czyZmianaPoziomuPlanu, odczytajWpisNawigacjiMapy, zbudujStanHistoriiMapy, zweryfikujPolozenieMapy } from '../src/moduly/zakupy/logika/nawigacjaMapyMagazynu'

test('stan historii mapy zachowuje widok i daje się odczytać', () => {
  const stan = zbudujStanHistoriiMapy({ widok: 'zakupy_mapa_magazynu' }, { rodzicId: 'a', wybranaId: null, indeks: 2 })
  assert.equal(stan.widok, 'zakupy_mapa_magazynu')
  assert.deepEqual(odczytajWpisNawigacjiMapy(stan), { rodzicId: 'a', wybranaId: null, indeks: 2 })
})

test('uszkodzony lub obcy stan historii nie jest wpisem mapy', () => {
  assert.equal(odczytajWpisNawigacjiMapy(null), null)
  assert.equal(odczytajWpisNawigacjiMapy({ widok: 'x' }), null)
  assert.equal(odczytajWpisNawigacjiMapy({ mapaMagazynu: { rodzicId: 'a', indeks: -1 } }), null)
  assert.equal(odczytajWpisNawigacjiMapy({ mapaMagazynu: { rodzicId: 5, wybranaId: 7, indeks: 1 } })?.rodzicId, null)
})

test('nieistniejące lokalizacje są odrzucane przy powrocie w historii', () => {
  assert.deepEqual(zweryfikujPolozenieMapy({ rodzicId: 'a', wybranaId: 'zniknela' }, new Set(['a'])), { rodzicId: 'a', wybranaId: null })
  assert.deepEqual(zweryfikujPolozenieMapy({ rodzicId: 'zniknela', wybranaId: 'a' }, new Set(['a'])), { rodzicId: null, wybranaId: 'a' })
})

test('tylko zmiana poziomu planu tworzy wpis historii', () => {
  assert.equal(czyZmianaPoziomuPlanu({ rodzicId: null, wybranaId: null }, { rodzicId: 'a', wybranaId: null }), true)
  assert.equal(czyZmianaPoziomuPlanu({ rodzicId: 'a', wybranaId: null }, { rodzicId: 'a', wybranaId: 'b' }), false)
})
