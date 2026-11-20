import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { zachowajReferencjeJesliRowne } from '../src/aplikacja/logowanie/stabilnyStan.ts'

test('równa zawartość zachowuje poprzednią referencję, zmiana zwraca nową', () => {
  const poprzednia = [{ id: 'a', emaile: ['a@x.pl'], telefony: [{ numer: '1' }] }]
  assert.equal(zachowajReferencjeJesliRowne(poprzednia, structuredClone(poprzednia)), poprzednia)
  const zmieniona = [{ id: 'a', emaile: ['b@x.pl'], telefony: [{ numer: '1' }] }]
  assert.equal(zachowajReferencjeJesliRowne(poprzednia, zmieniona), zmieniona)
  const dluzsza = [...poprzednia, { id: 'b', emaile: [], telefony: [] }]
  assert.equal(zachowajReferencjeJesliRowne(poprzednia, dluzsza), dluzsza)
})

test('wartości puste i identyczne referencje są obsługiwane', () => {
  const uzytkownik = { id: 'a' }
  assert.equal(zachowajReferencjeJesliRowne(uzytkownik, uzytkownik), uzytkownik)
  assert.equal(zachowajReferencjeJesliRowne(null, null), null)
  assert.deepEqual(zachowajReferencjeJesliRowne(null, uzytkownik), uzytkownik)
  assert.equal(zachowajReferencjeJesliRowne(uzytkownik as { id: string } | null, null), null)
  const lista: unknown[] = []
  assert.equal(zachowajReferencjeJesliRowne(lista, []), lista)
})

test('dane niemożliwe do serializacji nie przerywają pracy i zwracają nową wartość', () => {
  const okrag: { sam?: unknown } = {}
  okrag.sam = okrag
  const nowa: { sam?: unknown } = { sam: 1 }
  assert.equal(zachowajReferencjeJesliRowne(okrag, nowa), nowa)
})

test('dostawca użytkownika stabilizuje stan i wartość kontekstu oraz nasłuchuje zmian kont', () => {
  const dostawca = readFileSync(new URL('../src/aplikacja/logowanie/KontekstUzytkownika.tsx', import.meta.url), 'utf8')
  assert.match(dostawca, /useMemo\(\(\) => \(\{ zalogowanyUzytkownik, inicjalizacja, aktywniUzytkownicy, zaloguj, wyloguj, odswiezUzytkownika \}\)/)
  assert.match(dostawca, /zachowajReferencjeJesliRowne\(poprzedni, uzytkownik\)/)
  assert.match(dostawca, /subskrybujUzytkownikow\(odswiezAktywnychUzytkownikow\)/)
  assert.doesNotMatch(dostawca, /aktywniUzytkownicy: pobierzAktywnychUzytkownikowWedlugRoli\(\)/, 'Lista aktywnych kont nie może być odczytywana przy każdym renderze.')
})
