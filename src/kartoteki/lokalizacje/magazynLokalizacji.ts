import {
  pobierzWersjeDanychKataloguLokalizacji,
  pobierzZaladowanyIndeksKatalogu,
  pobierzZaladowaneLokalizacjeStartowe,
  zaladujIndeksKataloguLokalizacji,
} from './ladowanieKatalogu'
import type { Lokalizacja } from './typyLokalizacji'
import {
  brakPodpowiedziMiejscowosci,
  normalizujFrazeMiejscowosci,
  type PodpowiedziMiejscowosci,
  wybierzPodpowiedziMiejscowosci,
} from './wyszukiwanieMiejscowosci'

const kluczLokalizacji = 'ultimate-pomagier.kartoteki.lokalizacje'

/**
 * Kartoteka lokalizacji składa się z dwóch części:
 *  - danych startowych: statycznego katalogu ładowanego na żądanie (`ladowanieKatalogu.ts`), podzielonego na województwa,
 *  - zmian użytkownika: różnic względem katalogu, zapisanych w localStorage pod `kluczLokalizacji` (format bez zmian).
 * Funkcje synchroniczne działają na tym, co jest już wczytane. Zmiany użytkownika są zawsze dostępne w całości.
 */

/** Przygotowuje indeks nazw w czasie bezczynności, aby pierwsze podpowiedzi nie czekały na pobranie pliku. */
export function rozgrzejKartotekeLokalizacji() {
  return zaladujIndeksKataloguLokalizacji().then(() => undefined)
}

function czyObiekt(wartosc: unknown): wartosc is Record<string, unknown> {
  return Boolean(wartosc && typeof wartosc === 'object' && !Array.isArray(wartosc))
}

function tekst(wartosc: unknown) {
  return String(wartosc ?? '').trim()
}

function normalizujStatus(wartosc: unknown) {
  return wartosc === true || wartosc === 'true'
}

function normalizujLokalizacje(wartosc: unknown): Lokalizacja | null {
  if (!czyObiekt(wartosc)) {
    return null
  }

  const lokalizacja: Lokalizacja = {
    klucz_lokalizacji: tekst(wartosc.klucz_lokalizacji || wartosc.id),
    nazwa: tekst(wartosc.nazwa),
    wojewodztwo: tekst(wartosc.wojewodztwo),
    rodzaj: tekst(wartosc.rodzaj),
    gmina: tekst(wartosc.gmina),
    powiat: tekst(wartosc.powiat),
    miejscownik_pelny_auto: tekst(wartosc.miejscownik_pelny_auto || wartosc.miejscownik),
    status_odmiany: normalizujStatus(wartosc.status_odmiany ?? wartosc.miejscownikPotwierdzony),
  }

  if (!lokalizacja.klucz_lokalizacji || !lokalizacja.nazwa || !lokalizacja.miejscownik_pelny_auto) {
    return null
  }

  return lokalizacja
}

function odczytajZapisLokalizacji() {
  try {
    return localStorage.getItem(kluczLokalizacji)
  } catch {
    return null
  }
}

function odczytajLokalizacjeZMagazynu(zapis: string | null) {
  try {
    const dane = zapis ? JSON.parse(zapis) : null

    return Array.isArray(dane) ? dane.map(normalizujLokalizacje).filter((lokalizacja): lokalizacja is Lokalizacja => Boolean(lokalizacja)) : []
  } catch {
    return []
  }
}

// Zmiany użytkownika są parsowane raz dla danego zapisu w localStorage.
let pamiecZmian: { zapis: string | null; zmiany: Lokalizacja[] } | null = null

/** Zmiany użytkownika względem katalogu startowego (zmodyfikowane rekordy startowe i własne lokalizacje). Lista współdzielona, nie wolno jej modyfikować. */
export function pobierzZmianyLokalizacji() {
  const zapis = odczytajZapisLokalizacji()

  if (pamiecZmian?.zapis !== zapis) {
    pamiecZmian = { zapis, zmiany: odczytajLokalizacjeZMagazynu(zapis) }
  }

  return pamiecZmian.zmiany
}

function scalLokalizacje(startowe: Lokalizacja[], zmiany: Lokalizacja[]) {
  // Najczęstszy przypadek: użytkownik nie zmienił kartoteki. Zwracamy współdzieloną listę startową bez kopiowania rekordów.
  if (zmiany.length === 0) {
    return startowe
  }

  const mapa = new Map(startowe.map((lokalizacja) => [lokalizacja.klucz_lokalizacji, lokalizacja]))

  zmiany.forEach((lokalizacja) => {
    mapa.set(lokalizacja.klucz_lokalizacji, lokalizacja)
  })

  return [...mapa.values()]
}

// Scalona lista jest pamiętana dla tego samego zapisu i tej samej wersji wczytanych danych. Jest współdzielona i nie wolno jej modyfikować w miejscu.
let pamiecScalonychLokalizacji: { zapis: string | null; wersja: number; lokalizacje: Lokalizacja[] } | null = null

/**
 * Lokalizacje dostępne w pamięci: rekordy startowe wczytanych województw ze zmianami użytkownika.
 * Pełna lista jest dostępna po `zaladujCalyKatalogLokalizacji()`; do rozpoznania konkretnej nazwy wystarczy `zaladujLokalizacjeDlaNazw`.
 */
export function pobierzLokalizacjeZMagazynu() {
  const zapis = odczytajZapisLokalizacji()
  const wersja = pobierzWersjeDanychKataloguLokalizacji()

  if (pamiecScalonychLokalizacji && pamiecScalonychLokalizacji.zapis === zapis && pamiecScalonychLokalizacji.wersja === wersja) {
    return pamiecScalonychLokalizacji.lokalizacje
  }

  const lokalizacje = scalLokalizacje(pobierzZaladowaneLokalizacjeStartowe(), pobierzZmianyLokalizacji())
  pamiecScalonychLokalizacji = { zapis, wersja, lokalizacje }
  return lokalizacje
}

type NazwyMiejscowosci = { nazwy: readonly string[]; nazwyMale: readonly string[] }
let pamiecNazw: { zapis: string | null; indeks: object | null; nazwy: NazwyMiejscowosci } | null = null
const kolatorPolski = new Intl.Collator('pl')

/** Posortowane, unikalne nazwy miejscowości z katalogu oraz z własnych lokalizacji użytkownika. `null`, dopóki indeks katalogu nie jest wczytany. */
export function pobierzNazwyMiejscowosci(): NazwyMiejscowosci | null {
  const indeks = pobierzZaladowanyIndeksKatalogu()

  if (!indeks) {
    return null
  }

  const zapis = odczytajZapisLokalizacji()

  if (pamiecNazw && pamiecNazw.zapis === zapis && pamiecNazw.indeks === indeks) {
    return pamiecNazw.nazwy
  }

  const znane = new Set(indeks.nazwyMale)
  const wlasne = [...new Map(pobierzZmianyLokalizacji().filter((zmiana) => !znane.has(normalizujFrazeMiejscowosci(zmiana.nazwa))).map((zmiana) => [normalizujFrazeMiejscowosci(zmiana.nazwa), zmiana.nazwa])).values()]
  let nazwy: NazwyMiejscowosci = { nazwy: indeks.nazwy, nazwyMale: indeks.nazwyMale }

  if (wlasne.length > 0) {
    const polaczone = [...indeks.nazwy, ...wlasne].sort(kolatorPolski.compare)
    nazwy = { nazwy: polaczone, nazwyMale: polaczone.map((nazwa) => normalizujFrazeMiejscowosci(nazwa)) }
  }

  pamiecNazw = { zapis, indeks, nazwy }
  return nazwy
}

let ostatniaPodpowiedz: { nazwy: NazwyMiejscowosci; fraza: string; limit: number | undefined; wynik: PodpowiedziMiejscowosci } | null = null

/**
 * Podpowiedzi miejscowości: najpierw nazwy zaczynające się od frazy, potem zawierające ją. Pusty wynik, dopóki indeks nie jest wczytany.
 * Ostatni wynik jest pamiętany, więc ponowne renderowanie z tą samą frazą nie skanuje listy i zwraca ten sam obiekt.
 */
export function podpowiedzMiejscowosci(fraza: string, limit?: number): PodpowiedziMiejscowosci {
  const nazwy = pobierzNazwyMiejscowosci()

  if (!nazwy) {
    return brakPodpowiedziMiejscowosci
  }

  if (ostatniaPodpowiedz?.nazwy === nazwy && ostatniaPodpowiedz.fraza === fraza && ostatniaPodpowiedz.limit === limit) {
    return ostatniaPodpowiedz.wynik
  }

  const wynik = wybierzPodpowiedziMiejscowosci(nazwy.nazwy, nazwy.nazwyMale, fraza, limit)
  ostatniaPodpowiedz = { nazwy, fraza, limit, wynik }
  return wynik
}

export function zapiszLokalizacjeWMagazynie(lokalizacje: Lokalizacja[]) {
  try {
    const startoweWedlugKlucza = new Map(pobierzZaladowaneLokalizacjeStartowe().map((lokalizacja) => [lokalizacja.klucz_lokalizacji, lokalizacja]))
    const zmianyUzytkownika = lokalizacje.filter((lokalizacja) => {
      const lokalizacjaStartowa = startoweWedlugKlucza.get(lokalizacja.klucz_lokalizacji)

      return (
        !lokalizacjaStartowa ||
        lokalizacjaStartowa.nazwa !== lokalizacja.nazwa ||
        lokalizacjaStartowa.wojewodztwo !== lokalizacja.wojewodztwo ||
        lokalizacjaStartowa.rodzaj !== lokalizacja.rodzaj ||
        lokalizacjaStartowa.gmina !== lokalizacja.gmina ||
        lokalizacjaStartowa.powiat !== lokalizacja.powiat ||
        lokalizacjaStartowa.miejscownik_pelny_auto !== lokalizacja.miejscownik_pelny_auto ||
        lokalizacjaStartowa.status_odmiany !== lokalizacja.status_odmiany
      )
    })

    localStorage.setItem(kluczLokalizacji, JSON.stringify(zmianyUzytkownika))
    return true
  } catch {
    return false
  }
}

export function znajdzLokalizacjePoKluczu(klucz_lokalizacji: string, lokalizacje = pobierzLokalizacjeZMagazynu()) {
  return lokalizacje.find((lokalizacja) => lokalizacja.klucz_lokalizacji === klucz_lokalizacji) ?? null
}

export function znajdzLokalizacjeDlaMiejsca(miejsce: string, lokalizacje = pobierzLokalizacjeZMagazynu()) {
  const miastoZAdresu = miejsce.match(/\b\d{2}-\d{3}\s+([^,\n]+)\s*$/)?.[1]
  const szukanaNazwa = (miastoZAdresu ?? miejsce).trim().toLocaleLowerCase('pl')

  if (!szukanaNazwa) {
    return null
  }

  const dopasowania = lokalizacje.filter((lokalizacja) => lokalizacja.nazwa.toLocaleLowerCase('pl') === szukanaNazwa)
  return dopasowania.length === 1 ? dopasowania[0] : null
}

/**
 * Zapisuje potwierdzony miejscownik. Rekord musi być wczytany (wybrana lokalizacja zawsze jest); zapisujemy tylko tę jedną zmianę,
 * zachowując wcześniejsze zmiany użytkownika, także dla województw, które nie są teraz w pamięci.
 */
export function ustawPotwierdzonyMiejscownikLokalizacji(klucz_lokalizacji: string, miejscownik_pelny_auto: string) {
  const obecna = znajdzLokalizacjePoKluczu(klucz_lokalizacji)

  if (!obecna) {
    return null
  }

  const zmieniona: Lokalizacja = { ...obecna, miejscownik_pelny_auto: miejscownik_pelny_auto.trim(), status_odmiany: true }
  const zmiany = pobierzZmianyLokalizacji()
  const nastepneZmiany = zmiany.some((zmiana) => zmiana.klucz_lokalizacji === klucz_lokalizacji)
    ? zmiany.map((zmiana) => (zmiana.klucz_lokalizacji === klucz_lokalizacji ? zmieniona : zmiana))
    : [...zmiany, zmieniona]

  try {
    localStorage.setItem(kluczLokalizacji, JSON.stringify(nastepneZmiany))
  } catch {
    return null
  }

  return zmieniona
}

export function pobierzPotwierdzonyMiejscownikLokalizacji(klucz_lokalizacji: string) {
  const lokalizacja = znajdzLokalizacjePoKluczu(klucz_lokalizacji)

  if (!lokalizacja) {
    return { miejscownik: null, blad: 'Nie odnaleziono lokalizacji w kartotece.' }
  }

  if (!lokalizacja.status_odmiany) {
    return { miejscownik: null, blad: 'Odmiana nazwy tej lokalizacji nie została jeszcze potwierdzona.' }
  }

  return { miejscownik: lokalizacja.miejscownik_pelny_auto, blad: null }
}
