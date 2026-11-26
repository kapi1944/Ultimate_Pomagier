import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { zrodloKataloguZDysku, utworzZrodloZLicznikiem } from './zrodloKataloguLokalizacji.ts'

const magazyn = new Map<string, string>()
globalThis.localStorage = {
  getItem: (klucz: string) => magazyn.get(klucz) ?? null,
  setItem: (klucz: string, wartosc: string) => { magazyn.set(klucz, wartosc) },
  removeItem: (klucz: string) => { magazyn.delete(klucz) },
  clear: () => magazyn.clear(),
  key: () => null,
  length: 0,
} as Storage

const { importujLokalizacjeZCsv } = await import('../src/kartoteki/lokalizacje/importerLokalizacji.ts')
const { zbudujKatalogStatyczny, rozpakujPlikWojewodztwa, sprawdzPlikIndeksuKatalogu } = await import('../src/kartoteki/lokalizacje/katalogStatyczny.ts')
const { wybierzPodpowiedziMiejscowosci } = await import('../src/kartoteki/lokalizacje/wyszukiwanieMiejscowosci.ts')
const ladowanie = await import('../src/kartoteki/lokalizacje/ladowanieKatalogu.ts')
const kartoteka = await import('../src/kartoteki/lokalizacje/magazynLokalizacji.ts')
const { zbudujIndeksLokalizacjiSzczegolow, pobierzWspolnyIndeksLokalizacji } = await import('../src/moduly/zamkniete/szczegoly_organizacyjne/uslugi/indeksLokalizacjiSzczegolow.ts')

const csv = readFileSync(new URL('../src/kartoteki/lokalizacje/dane/kartoteka_lokalizacje_miejscowosci_2019.csv', import.meta.url), 'utf8')
const wynikCsv = importujLokalizacjeZCsv(csv)
const kolator = new Intl.Collator('pl')

function wyczysc() {
  magazyn.clear()
  ladowanie.ustawZrodloKataloguLokalizacji(zrodloKataloguZDysku)
}

test('wygenerowane pliki katalogu odpowiadają kartotece CSV (po zmianie CSV uruchom npm run katalog:lokalizacje)', async () => {
  assert.deepEqual(wynikCsv.bledy, [])
  const katalog = zbudujKatalogStatyczny(wynikCsv.lokalizacje)
  assert.deepEqual(await zrodloKataloguZDysku('indeks.json'), JSON.parse(JSON.stringify(katalog.indeks)), 'indeks.json jest nieaktualny')

  for (const opis of katalog.indeks.wojewodztwa) {
    assert.deepEqual(await zrodloKataloguZDysku(opis.plik), JSON.parse(JSON.stringify(katalog.pliki.get(opis.kod))), `${opis.plik} jest nieaktualny`)
  }

  const naDysku = readdirSync(new URL('../public/dane/lokalizacje/', import.meta.url)).filter((nazwa) => nazwa.endsWith('.json')).sort()
  assert.deepEqual(naDysku, ['indeks.json', ...katalog.indeks.wojewodztwa.map((opis) => opis.plik)].sort(), 'w katalogu nie mogą zostać stare pliki')
})

test('rozpakowanie wszystkich plików województw odtwarza dokładnie rekordy z CSV', async () => {
  const indeks = sprawdzPlikIndeksuKatalogu(await zrodloKataloguZDysku('indeks.json'))
  const rozpakowane = (await Promise.all(indeks.wojewodztwa.map(async (opis) => rozpakujPlikWojewodztwa(await zrodloKataloguZDysku(opis.plik) as never)))).flat()
  const wedlugKlucza = (lista: typeof rozpakowane) => [...lista].sort((a, b) => (a.klucz_lokalizacji < b.klucz_lokalizacji ? -1 : 1))
  assert.equal(rozpakowane.length, wynikCsv.lokalizacje.length)
  assert.deepEqual(wedlugKlucza(rozpakowane), wedlugKlucza(wynikCsv.lokalizacje))
  assert.equal(indeks.wojewodztwa.reduce((suma, opis) => suma + opis.liczba, 0), wynikCsv.lokalizacje.length)
})

test('indeks nazw jest posortowany, unikalny i ma maski województw zgodne z rekordami', async () => {
  const indeks = sprawdzPlikIndeksuKatalogu(await zrodloKataloguZDysku('indeks.json'))
  assert.deepEqual(indeks.nazwy, [...indeks.nazwy].sort(kolator.compare))
  assert.equal(new Set(indeks.nazwy).size, indeks.nazwy.length)
  assert.equal(new Set(wynikCsv.lokalizacje.map((l) => l.nazwa)).size, indeks.nazwy.length)
  const numerWojewodztwa = new Map(indeks.wojewodztwa.map((opis, numer) => [opis.kod, numer]))
  const oczekiwane = new Map<string, number>()
  wynikCsv.lokalizacje.forEach((l) => oczekiwane.set(l.nazwa, (oczekiwane.get(l.nazwa) ?? 0) | (1 << (numerWojewodztwa.get(l.wojewodztwo.split(/\s+/)[0]) ?? 0))))
  indeks.nazwy.forEach((nazwa, numer) => assert.equal(indeks.maski[numer], oczekiwane.get(nazwa), nazwa))
})

test('uszkodzony indeks lub plik województwa jest odrzucany czytelnym błędem', () => {
  assert.throws(() => sprawdzPlikIndeksuKatalogu({ wersja: 2 }), /nieprawidłowy format/)
  assert.throws(() => sprawdzPlikIndeksuKatalogu({ wersja: 1, wojewodztwa: [], nazwy: ['a'], maski: [] }), /nieprawidłowy format/)
  assert.throws(() => rozpakujPlikWojewodztwa({ wersja: 9 } as never), /nieprawidłowy format/)
})

test('podpowiedzi: najpierw nazwy zaczynające się od frazy (alfabetycznie), potem zawierające ją', async () => {
  const indeks = sprawdzPlikIndeksuKatalogu(await zrodloKataloguZDysku('indeks.json'))
  const male = indeks.nazwy.map((nazwa) => nazwa.toLocaleLowerCase('pl'))
  const wynik = wybierzPodpowiedziMiejscowosci(indeks.nazwy, male, 'do')
  assert.equal(wynik.poczatek.length, 50, 'dla „do” jest wiele miejscowości zaczynających się od frazy')
  assert.equal(wynik.zawierajace.length, 0, 'limit 50 wyczerpują nazwy zaczynające się od frazy')
  assert.ok(wynik.poczatek.every((nazwa) => nazwa.toLocaleLowerCase('pl').startsWith('do')))
  assert.deepEqual(wynik.poczatek, [...wynik.poczatek].sort(kolator.compare))
  assert.ok(wynik.poczatek.includes('Do Adama'))

  const rzadka = wybierzPodpowiedziMiejscowosci(indeks.nazwy, male, 'wadowice')
  assert.ok(rzadka.poczatek.includes('Wadowice Górne'))
  assert.ok(rzadka.poczatek.every((nazwa) => nazwa.toLocaleLowerCase('pl').startsWith('wadowice')))
  assert.ok(rzadka.zawierajace.every((nazwa) => nazwa.toLocaleLowerCase('pl').includes('wadowice') && !nazwa.toLocaleLowerCase('pl').startsWith('wadowice')))
})

test('podpowiedzi: nazwy zawierające frazę trafiają po nazwach zaczynających się od niej, bez duplikatów i z limitem łącznym', () => {
  const nazwy = ['Adowo', 'Do', 'Dobrowice', 'Dolina', 'Wadowice', 'Zadowice', 'Żadow']
  const male = nazwy.map((n) => n.toLocaleLowerCase('pl'))
  assert.deepEqual(wybierzPodpowiedziMiejscowosci(nazwy, male, ' DO '), {
    poczatek: ['Do', 'Dobrowice', 'Dolina'],
    zawierajace: ['Adowo', 'Wadowice', 'Zadowice', 'Żadow'],
  })
  assert.deepEqual(wybierzPodpowiedziMiejscowosci(nazwy, male, 'do', 4), { poczatek: ['Do', 'Dobrowice', 'Dolina'], zawierajace: ['Adowo'] })
  assert.deepEqual(wybierzPodpowiedziMiejscowosci(nazwy, male, 'do', 2), { poczatek: ['Do', 'Dobrowice'], zawierajace: [] })
  assert.deepEqual(wybierzPodpowiedziMiejscowosci(nazwy, male, 'żad'), { poczatek: ['Żadow'], zawierajace: [] })
  assert.deepEqual(wybierzPodpowiedziMiejscowosci(nazwy, male, 'xyz'), { poczatek: [], zawierajace: [] })
  assert.deepEqual(wybierzPodpowiedziMiejscowosci(nazwy, male, '  ', 3), { poczatek: ['Adowo', 'Do', 'Dobrowice'], zawierajace: [] })
})

test('indeks nazw jest ładowany raz, bez pobierania województw', async () => {
  wyczysc()
  const { zrodlo, pobrane } = utworzZrodloZLicznikiem()
  ladowanie.ustawZrodloKataloguLokalizacji(zrodlo)
  const [a, b] = await Promise.all([ladowanie.zaladujIndeksKataloguLokalizacji(), ladowanie.zaladujIndeksKataloguLokalizacji()])
  assert.equal(a, b)
  assert.deepEqual(pobrane, ['indeks.json'])
  assert.equal(ladowanie.pobierzZaladowaneLokalizacjeStartowe().length, 0)
  assert.equal(kartoteka.podpowiedzMiejscowosci('dobiegn').poczatek[0], 'Dobiegniew')
})

test('rekordy są ładowane tylko dla województw wskazanych przez nazwę i są zwracane jako współdzielona lista', async () => {
  wyczysc()
  const { zrodlo, pobrane } = utworzZrodloZLicznikiem()
  ladowanie.ustawZrodloKataloguLokalizacji(zrodlo)
  const wersjaPrzed = ladowanie.pobierzWersjeKataloguLokalizacji()
  await ladowanie.zaladujLokalizacjeDlaNazw(['Dobiegniew', 'nieistniejąca miejscowość'])
  assert.ok(ladowanie.pobierzWersjeKataloguLokalizacji() > wersjaPrzed)
  const wojewodztwaDobiegniewa = new Set(wynikCsv.lokalizacje.filter((l) => l.nazwa === 'Dobiegniew').map((l) => l.wojewodztwo.split(/\s+/)[0]))
  assert.equal(pobrane.length, 1 + wojewodztwaDobiegniewa.size, 'indeks i tylko potrzebne województwa')
  assert.ok(pobrane.length < 5)
  const lista = ladowanie.pobierzZaladowaneLokalizacjeStartowe()
  assert.ok(lista.length > 0 && lista.length < wynikCsv.lokalizacje.length / 2)
  assert.equal(ladowanie.pobierzZaladowaneLokalizacjeStartowe(), lista)
  await ladowanie.zaladujLokalizacjeDlaNazw(['dobiegniew'])
  assert.equal(pobrane.length, 1 + wojewodztwaDobiegniewa.size, 'ponowne żądanie nie pobiera plików drugi raz')
  assert.equal(kartoteka.pobierzLokalizacjeZMagazynu(), lista, 'bez zmian użytkownika scalona lista to lista startowa')
  const liczba = wynikCsv.lokalizacje.filter((l) => l.nazwa === 'Dobiegniew').length
  assert.equal(kartoteka.znajdzLokalizacjeDlaMiejsca('Dobiegniew')?.nazwa, liczba === 1 ? 'Dobiegniew' : undefined, 'nazwa wieloznaczna nie wskazuje jednej lokalizacji')
})

test('pełny katalog po wczytaniu wszystkich województw zawiera wszystkie rekordy', async () => {
  wyczysc()
  await ladowanie.zaladujCalyKatalogLokalizacji()
  assert.equal(kartoteka.pobierzLokalizacjeZMagazynu().length, wynikCsv.lokalizacje.length)
})

test('błąd pobierania nie jest zapamiętywany na stałe: kolejne wywołanie ponawia próbę', async () => {
  wyczysc()
  let proby = 0
  ladowanie.ustawZrodloKataloguLokalizacji(async (nazwa) => {
    proby += 1
    if (proby === 1) throw new Error('brak sieci')
    return zrodloKataloguZDysku(nazwa)
  })
  await assert.rejects(ladowanie.zaladujIndeksKataloguLokalizacji(), /brak sieci/)
  assert.equal(ladowanie.pobierzBladKataloguLokalizacji()?.message, 'brak sieci')
  assert.equal(kartoteka.podpowiedzMiejscowosci('do').poczatek.length, 0, 'bez indeksu nie ma podpowiedzi, ale nic się nie psuje')
  await ladowanie.zaladujIndeksKataloguLokalizacji()
  assert.equal(ladowanie.pobierzBladKataloguLokalizacji(), null)
  assert.ok(kartoteka.podpowiedzMiejscowosci('do').poczatek.length > 0)
})

test('podpowiedzi uwzględniają własne lokalizacje użytkownika spoza katalogu', async () => {
  wyczysc()
  await ladowanie.zaladujIndeksKataloguLokalizacji()
  const bazowe = kartoteka.pobierzNazwyMiejscowosci()
  assert.equal(kartoteka.pobierzNazwyMiejscowosci(), bazowe)
  magazyn.set('ultimate-pomagier.kartoteki.lokalizacje', JSON.stringify([{ klucz_lokalizacji: 'wlasna_1', nazwa: 'Dobry Ośrodek', miejscownik_pelny_auto: 'Dobrym Ośrodku', status_odmiany: true }]))
  const poZmianie = kartoteka.pobierzNazwyMiejscowosci()
  assert.notEqual(poZmianie, bazowe)
  assert.equal(poZmianie?.nazwy.length, (bazowe?.nazwy.length ?? 0) + 1)
  assert.deepEqual(poZmianie?.nazwy, [...(poZmianie?.nazwy ?? [])].sort(kolator.compare))
  assert.ok(kartoteka.podpowiedzMiejscowosci('dobry o').poczatek.includes('Dobry Ośrodek'))
})

test('indeks Szczegółów: nazwa jest rozpoznawana dopiero po wczytaniu jej województw i tylko gdy jest jednoznaczna', async () => {
  wyczysc()
  await ladowanie.zaladujIndeksKataloguLokalizacji()
  const indeksPrzed = pobierzWspolnyIndeksLokalizacji()
  assert.equal(pobierzWspolnyIndeksLokalizacji(), indeksPrzed, 'bez zmian ten sam obiekt')
  assert.equal(indeksPrzed.znajdz('Dobiegniew'), null, 'rekordy nie są jeszcze wczytane')

  const liczbaNazw = new Map<string, number>()
  wynikCsv.lokalizacje.forEach((l) => liczbaNazw.set(l.nazwa.toLocaleLowerCase('pl'), (liczbaNazw.get(l.nazwa.toLocaleLowerCase('pl')) ?? 0) + 1))
  const jednoznaczna = wynikCsv.lokalizacje.find((l) => liczbaNazw.get(l.nazwa.toLocaleLowerCase('pl')) === 1 && /^[A-Za-z]+$/.test(l.nazwa))
  const wieloznaczna = [...liczbaNazw].find(([nazwa, liczba]) => liczba > 1 && /^[a-z]+$/.test(nazwa))?.[0]
  assert.ok(jednoznaczna && wieloznaczna)

  await ladowanie.zaladujLokalizacjeDlaNazw([jednoznaczna.nazwa, wieloznaczna])
  const indeksPo = pobierzWspolnyIndeksLokalizacji()
  assert.notEqual(indeksPo, indeksPrzed)
  assert.equal(indeksPo.znajdz(` ${jednoznaczna.nazwa.toUpperCase()} `)?.klucz_lokalizacji, jednoznaczna.klucz_lokalizacji)
  assert.equal(indeksPo.znajdz(`ul. Długa 1, 00-001 ${jednoznaczna.nazwa}`)?.klucz_lokalizacji, jednoznaczna.klucz_lokalizacji)
  assert.equal(indeksPo.znajdz(wieloznaczna), null, 'nazwa występująca wiele razy nie wskazuje jednej lokalizacji')
  assert.deepEqual(indeksPo.podpowiedz('dobiegn').poczatek[0], 'Dobiegniew')
})

test('indeks Szczegółów nie uznaje nazwy za jednoznaczną, gdy część jej województw nie jest wczytana', async () => {
  wyczysc()
  await ladowanie.zaladujIndeksKataloguLokalizacji()
  const indeks = ladowanie.pobierzZaladowanyIndeksKatalogu()
  assert.ok(indeks)
  const maskaWieloWojewodzka = [...new Set(indeks.nazwyMale)].map((nazwa) => ({ nazwa, maska: indeks.pobierzMaske(nazwa) ?? 0 })).find(({ maska }) => (maska & (maska - 1)) !== 0)
  assert.ok(maskaWieloWojewodzka)
  const pierwszyBit = maskaWieloWojewodzka.maska & -maskaWieloWojewodzka.maska
  await ladowanie.zaladujWojewodztwaPoMasce(pierwszyBit)
  assert.equal(pobierzWspolnyIndeksLokalizacji().znajdz(maskaWieloWojewodzka.nazwa), null, 'brakuje reszty województw, więc nie wiadomo, czy nazwa jest jednoznaczna')
})

test('indeks na liście w pamięci (bez katalogu) rozpoznaje jednoznaczne nazwy i zachowuje polskie znaki', () => {
  const rekord = (nazwa: string, klucz = nazwa) => ({ nazwa, klucz_lokalizacji: klucz, wojewodztwo: '', rodzaj: '', gmina: '', powiat: '', miejscownik_pelny_auto: 'x', status_odmiany: false })
  const lodz = rekord('Łódź')
  const indeks = zbudujIndeksLokalizacjiSzczegolow([lodz, rekord('Mielec'), rekord('Brzeziny', 'a'), rekord('BRZEZINY', 'b'), rekord('')])
  assert.deepEqual(indeks.znajdz(' ŁÓDŹ '), lodz)
  assert.equal(indeks.znajdz('Lodz'), null)
  assert.equal(indeks.znajdz('Brzeziny'), null)
  for (const miejsce of ['', ' ']) assert.equal(indeks.znajdz(miejsce), null, JSON.stringify(miejsce))
})

test('wczytanie kilku województw naraz udostępnia je jednocześnie i powiadamia widoki raz', async () => {
  wyczysc()
  await ladowanie.zaladujIndeksKataloguLokalizacji()
  const indeks = ladowanie.pobierzZaladowanyIndeksKatalogu()
  assert.ok(indeks)
  const wielowojewodzka = indeks.nazwy.find((nazwa) => {
    const maska = indeks.pobierzMaske(nazwa.toLocaleLowerCase('pl')) ?? 0
    return (maska & (maska - 1)) !== 0 && (maska & (maska - 1) & ((maska & (maska - 1)) - 1)) !== 0
  })
  assert.ok(wielowojewodzka, 'w katalogu są nazwy występujące w co najmniej trzech województwach')
  let powiadomienia = 0
  const anuluj = ladowanie.subskrybujKatalogLokalizacji(() => { powiadomienia += 1 })
  const wersjaDanychPrzed = ladowanie.pobierzWersjeDanychKataloguLokalizacji()
  await ladowanie.zaladujLokalizacjeDlaNazw([wielowojewodzka])
  anuluj()
  assert.equal(powiadomienia, 1)
  assert.equal(ladowanie.pobierzWersjeDanychKataloguLokalizacji(), wersjaDanychPrzed + 1)
  assert.ok(ladowanie.pobierzMaskeZaladowanychWojewodztw() === (indeks.pobierzMaske(wielowojewodzka.toLocaleLowerCase('pl')) ?? 0))
})
