import assert from 'node:assert/strict'
import test from 'node:test'
import { daneStartoweUzytkownikow } from '../src/kartoteki/uzytkownicy/daneUzytkownikow.ts'
import { normalizujFraze, ocenDopasowanie, utworzWyszukiwarke, pobierzHistorieWyszukiwania, zapiszOtwartyWynik, type WynikWyszukiwania, type ZrodloWyszukiwania } from '../src/aplikacja/wyszukiwanie/mechanizmWyszukiwania.ts'

const uzytkownik = daneStartoweUzytkownikow[0]
const kontekst = () => ({ uzytkownik, sygnal: new AbortController().signal })
const wynik = (id = '1', kategoria = 'Klienci'): WynikWyszukiwania => ({ id, kategoria, nazwa: 'Zażółć gęślą jaźń', opis: 'Łódź', informacje: 'Szkolenie', cel: { widok: 'kartoteki_klienci', rekordId: id } })
const zrodlo = (rekordy: WynikWyszukiwania[]): ZrodloWyszukiwania => ({ id: 'test', czyDostepne: () => true, pobierz: async () => rekordy })

test('normalizacja, fragmenty, odmiana wielkości liter i pojedyncze literówki', () => {
  assert.equal(normalizujFraze(' ZAŻÓŁĆ GĘŚLĄ JAŹŃ ŁÓDŹ '), 'zazolc gesla jazn lodz')
  for (const fraza of ['ZAZOLC', 'żół', 'lodz', 'szkolnie', 'szkoelnie', 'szkolxenie']) assert.ok(ocenDopasowanie(wynik(), fraza) > 0, fraza)
  assert.equal(ocenDopasowanie(wynik(), 'nieistniejacy'), 0)
  assert.ok(ocenDopasowanie(wynik(), 'zazolc') > ocenDopasowanie(wynik(), 'zazlc'))
})
test('grupy, ranking, limit i brak wyników', async () => {
  const silnik = utworzWyszukiwarke([zrodlo([...Array.from({ length: 20 }, (_, indeks) => wynik(String(indeks))), wynik('trener', 'Trenerzy')])])
  const odpowiedz = await silnik.szukaj('zazolc', kontekst())
  assert.deepEqual(odpowiedz.grupy.map((grupa) => [grupa.kategoria, grupa.wyniki.length]), [['Klienci', 5], ['Trenerzy', 1]])
  assert.equal((await silnik.szukaj('xyzqqq', kontekst())).grupy.length, 0)
  assert.equal((await silnik.szukaj('', kontekst())).grupy.length, 0)
})
test('uprawnienia są sprawdzane przed odczytem źródła; nieaktywne konto nic nie odczytuje', async () => {
  let odczyty = 0
  const silnik = utworzWyszukiwarke([{ id: 'prywatne', czyDostepne: () => false, pobierz: async () => { odczyty++; return [wynik()] } }])
  assert.equal((await silnik.szukaj('zazolc', kontekst())).ograniczonyDostep, true)
  assert.equal(odczyty, 0)
  silnik.zarejestruj({ ...zrodlo([wynik()]), pobierz: async () => { odczyty++; return [wynik()] } })
  await silnik.szukaj('zazolc', { ...kontekst(), uzytkownik: { ...uzytkownik, status: 'NIEAKTYWNY' } })
  assert.equal(odczyty, 0)
})
test('błąd adaptera zachowuje wyniki innych źródeł', async () => {
  const silnik = utworzWyszukiwarke([zrodlo([wynik()]), { id: 'uszkodzone', czyDostepne: () => true, pobierz: async () => { throw new Error('Błąd testowy') } }])
  const odpowiedz = await silnik.szukaj('lodz', kontekst())
  assert.deepEqual(odpowiedz.bledy, ['uszkodzone'])
  assert.equal(odpowiedz.grupy[0].wyniki[0].id, '1')
})
test('anulowane zapytanie nie dostarcza wyników, także w trakcie odczytu', async () => {
  const kontroler = new AbortController()
  const silnik = utworzWyszukiwarke([{ ...zrodlo([wynik()]), pobierz: async () => { kontroler.abort(); return [wynik()] } }])
  await assert.rejects(() => silnik.szukaj('lodz', { uzytkownik, sygnal: kontroler.signal }), { name: 'AbortError' })
})
test('historia zawiera tylko nadal dostępne identyfikatory, polecenia są osobne', async () => {
  const silnik = utworzWyszukiwarke([zrodlo([wynik()]), { ...zrodlo([wynik('akcja', 'Polecenia')]), id: 'polecenia', polecenia: true }])
  assert.deepEqual((await silnik.szukaj('', kontekst(), ['usuniety', '1'])).grupy.flatMap((grupa) => grupa.wyniki).map((pozycja) => pozycja.id), ['1'])
  assert.equal((await silnik.szukaj('+', kontekst())).grupy[0].wyniki[0].id, 'akcja')
})
test('historia per konto nie utrwala nazw ani treści i toleruje uszkodzony zapis', () => {
  const pamiec = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (klucz: string) => pamiec.get(klucz) ?? null, setItem: (klucz: string, wartosc: string) => pamiec.set(klucz, wartosc) } })
  for (let indeks = 0; indeks < 15; indeks++) assert.equal(zapiszOtwartyWynik('pierwszy', `klient:${indeks}`), true)
  assert.equal(pobierzHistorieWyszukiwania('pierwszy').length, 10)
  assert.deepEqual(pobierzHistorieWyszukiwania('drugi'), [])
  for (const klucz of pamiec.keys()) pamiec.set(klucz, '{')
  assert.deepEqual(pobierzHistorieWyszukiwania('pierwszy'), [])
})
test('większy zbiór zachowuje limit i oddaje sterowanie pętli zdarzeń', async () => {
  const silnik = utworzWyszukiwarke([zrodlo(Array.from({ length: 10000 }, (_, indeks) => wynik(String(indeks))))])
  let oddanoSterowanie = false
  setTimeout(() => { oddanoSterowanie = true }, 0)
  const poczatek = performance.now()
  const odpowiedz = await silnik.szukaj('zazolc', kontekst())
  assert.equal(odpowiedz.grupy[0].wyniki.length, 5)
  assert.equal(oddanoSterowanie, true)
  assert.ok(performance.now() - poczatek < 3000)
})

test('adaptery czytają rzeczywiste magazyny, respektują widoczność i zachowują stabilne cele', async () => {
  const pamiec = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (klucz: string) => pamiec.get(klucz) ?? null, setItem: (klucz: string, wartosc: string) => pamiec.set(klucz, wartosc),
    removeItem: (klucz: string) => pamiec.delete(klucz), clear: () => pamiec.clear(), key: () => null, length: 0,
  } })
  const opiekun = daneStartoweUzytkownikow.find((konto) => konto.rola === 'OPIEKUN')!
  pamiec.set('ultimatePomagier.uzytkownicy.v1', JSON.stringify({ wersja: 2, uzytkownicy: daneStartoweUzytkownikow, historia: [] }))
  pamiec.set('ultimate-pomagier.kartoteki.klienci', JSON.stringify([{ id: 'klient-test', nazwa: 'Unikalny klient', nip: '123', miasto: 'Łódź', koordynator: 'Jan' }]))
  pamiec.set('ultimate-pomagier.kartoteki.trenerzy', JSON.stringify([{ id: 'trener-test', imie: 'Unikalny', nazwisko: 'Trener', telefon: '123', email: 'trener@example.test', status: 'Nieaktywny' }]))
  const zadania = [opiekun.id, 'inna-osoba'].map((id) => ({ id: `zadanie-${id}`, tytul: 'Unikalny termin', data: '2026-11-26', utworzono: '2026-11-26T10:00:00Z', status: 'OTWARTE', priorytet: 'ZWYKLE', typZrodla: 'RECZNE', typZadania: 'ZADANIE_WLASNE', zadaniodawcaId: id, zadaniobiorcaId: id, wlascicielId: id, przypomnienia: [], czyAutomatyczne: false, czyTerminKrytyczny: false }))
  pamiec.set('ultimatePomagier.pulpit.v1', JSON.stringify({ zadaniaReczne: zadania, wyslanePaczki: {}, zapotrzebowaniaZakupowe: [] }))
  const { pusteDaneMagazynowe } = await import('../src/moduly/zakupy/logika/przypisaniaMagazynowe.ts')
  pamiec.set('ultimatePomagier.zakupy.lokalizacje.v1', JSON.stringify({ wersja: 2, lokalizacje: [], daneMagazynowe: { ...pusteDaneMagazynowe(), produkty: [{ id: 'produkt-test', nazwa: 'Unikalny produkt', rodzaj: 'SPRZET', sposobEwidencji: 'ILOSCIOWY', jednostkaMiary: 'szt.', czyAktywny: true }] } }))
  const { utworzNowyDokument } = await import('../src/wspolne/dokumenty/modelDokumentu.ts')
  const { repozytoriumWspolnychDokumentow } = await import('../src/wspolne/dokumenty/rejestrDokumentow.ts')
  for (const [id, widocznosc] of [['dokument-test', 'zespol'], ['dokument-prywatny', 'prywatny']]) {
    repozytoriumWspolnychDokumentow.utworz(utworzNowyDokument({ id, typ: 'ANKIETA', tytul: 'Unikalny dokument', generatorId: 'ankiety', daneDokumentu: {}, ustawieniaDokumentu: {}, widocznosc, wlascicielId: 'inna-osoba' }))
  }
  for (const id of [opiekun.id, 'inna-osoba']) {
    repozytoriumWspolnychDokumentow.utworz(utworzNowyDokument({ id: `szkolenie-${id}`, typ: 'SZCZEGOLY_ORGANIZACYJNE', tytul: 'Unikalny projekt', generatorId: 'szczegoly_organizacyjne', daneDokumentu: { id: `szkolenie-${id}`, nazwa: 'Unikalny projekt', autorId: id, dane: { nazwaKlienta: 'Unikalny klient', opiekunId: id }, grupy: [] }, ustawieniaDokumentu: {} }))
  }
  const { wyszukiwarkaGlobalna } = await import('../src/aplikacja/wyszukiwanie/zrodlaWyszukiwania.ts')
  const kontekstOpiekuna = { uzytkownik: opiekun, sygnal: new AbortController().signal }
  const odpowiedz = await wyszukiwarkaGlobalna.szukaj('unikalny', kontekstOpiekuna)
  assert.deepEqual(odpowiedz.bledy, [])
  const wyniki = odpowiedz.grupy.flatMap((grupa) => grupa.wyniki)
  for (const id of ['klient:klient-test', 'trener:trener-test', `szkolenie:szkolenie-${opiekun.id}`, `zadanie:zadanie-${opiekun.id}`, 'dokument:dokument-test', 'produkt:produkt-test']) assert.ok(wyniki.some((wynik) => wynik.id === id), id)
  for (const id of ['dokument:dokument-prywatny', 'szkolenie:szkolenie-inna-osoba', 'zadanie:zadanie-inna-osoba']) assert.ok(!wyniki.some((wynik) => wynik.id === id), id)
  assert.deepEqual((await wyszukiwarkaGlobalna.znajdzPoId('klient:klient-test', kontekstOpiekuna))?.cel, { widok: 'kartoteki_klienci', rekordId: 'klient-test' })
  const gosc = { ...opiekun, rola: 'GOSC' as const }
  assert.equal((await wyszukiwarkaGlobalna.szukaj('unikalny', { ...kontekstOpiekuna, uzytkownik: gosc })).grupy.length, 0)
  assert.equal(await wyszukiwarkaGlobalna.znajdzPoId('klient:klient-test', { ...kontekstOpiekuna, uzytkownik: gosc }), null)
  assert.ok(!(await wyszukiwarkaGlobalna.szukaj('użytkownicy', kontekstOpiekuna)).grupy.some((grupa) => grupa.wyniki.some((wynik) => wynik.cel.widok === 'kartoteki_uzytkownicy')))
})
