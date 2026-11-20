import tekstLokalizacjiCsv from './dane/kartoteka_lokalizacje_miejscowosci_2019.csv?raw'
import { importujLokalizacjeZCsv } from './importerLokalizacji'
import type { Lokalizacja } from './typyLokalizacji'

const kluczLokalizacji = 'ultimate-pomagier.kartoteki.lokalizacje'

// Kartoteka startowa liczy ponad 70 tys. rekordów. Parsowanie na poziomie modułu blokowało start całej aplikacji,
// dlatego dane są budowane dopiero przy pierwszym użyciu (albo w rozgrzewce po pierwszym renderze).
type DaneStartowe = {
  wynikImportu: ReturnType<typeof importujLokalizacjeZCsv>
  lokalizacje: Lokalizacja[]
  wedlugKlucza: Map<string, Lokalizacja>
}

let daneStartowe: DaneStartowe | null = null

function pobierzDaneStartowe(): DaneStartowe {
  if (!daneStartowe) {
    const wynikImportu = importujLokalizacjeZCsv(tekstLokalizacjiCsv)
    daneStartowe = {
      wynikImportu,
      lokalizacje: wynikImportu.lokalizacje,
      wedlugKlucza: new Map(wynikImportu.lokalizacje.map((lokalizacja) => [lokalizacja.klucz_lokalizacji, lokalizacja])),
    }
  }

  return daneStartowe
}

/** Przygotowuje kartotekę startową w czasie bezczynności, aby pierwszy widok korzystający z lokalizacji nie czekał na parsowanie. */
export function rozgrzejKartotekeLokalizacji() {
  pobierzDaneStartowe()
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

function scalLokalizacje(seed: Lokalizacja[], zapisane: Lokalizacja[]) {
  const mapa = new Map(seed.map((lokalizacja) => [lokalizacja.klucz_lokalizacji, lokalizacja]))

  zapisane.forEach((lokalizacja) => {
    mapa.set(lokalizacja.klucz_lokalizacji, lokalizacja)
  })

  return [...mapa.values()]
}

export function pobierzLokalizacjeStartowe() {
  return pobierzDaneStartowe().lokalizacje
}

export function pobierzBledyImportuStartowego() {
  return pobierzDaneStartowe().wynikImportu.bledy
}

// Scalona lista jest pamiętana dla tego samego zapisu w localStorage, bo budowanie mapy 70 tys. rekordów
// przy każdym wywołaniu było kosztowne. Zwracana lista jest współdzielona i nie wolno jej modyfikować w miejscu.
let pamiecScalonychLokalizacji: { zapis: string | null; lokalizacje: Lokalizacja[] } | null = null

export function pobierzLokalizacjeZMagazynu() {
  const zapis = odczytajZapisLokalizacji()

  if (pamiecScalonychLokalizacji && pamiecScalonychLokalizacji.zapis === zapis) {
    return pamiecScalonychLokalizacji.lokalizacje
  }

  const lokalizacje = scalLokalizacje(pobierzDaneStartowe().lokalizacje, odczytajLokalizacjeZMagazynu(zapis))
  pamiecScalonychLokalizacji = { zapis, lokalizacje }
  return lokalizacje
}

export function zapiszLokalizacjeWMagazynie(lokalizacje: Lokalizacja[]) {
  try {
    const lokalizacjeStartoweWedlugKlucza = pobierzDaneStartowe().wedlugKlucza
    const zmianyUzytkownika = lokalizacje.filter((lokalizacja) => {
      const lokalizacjaStartowa = lokalizacjeStartoweWedlugKlucza.get(lokalizacja.klucz_lokalizacji)

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
  } catch {
    return
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

export function ustawPotwierdzonyMiejscownikLokalizacji(klucz_lokalizacji: string, miejscownik_pelny_auto: string) {
  const lokalizacje = pobierzLokalizacjeZMagazynu()
  const zmienione = lokalizacje.map((lokalizacja) =>
    lokalizacja.klucz_lokalizacji === klucz_lokalizacji
      ? {
          ...lokalizacja,
          miejscownik_pelny_auto: miejscownik_pelny_auto.trim(),
          status_odmiany: true,
        }
      : lokalizacja,
  )

  zapiszLokalizacjeWMagazynie(zmienione)
  return znajdzLokalizacjePoKluczu(klucz_lokalizacji, zmienione)
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
