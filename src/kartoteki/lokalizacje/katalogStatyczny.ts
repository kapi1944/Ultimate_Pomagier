import type { Lokalizacja } from './typyLokalizacji'

/**
 * Format statycznego katalogu lokalizacji ładowanego na żądanie.
 *
 * Źródłem danych pozostaje plik CSV kartoteki. Skrypt `skrypty/generujKatalogLokalizacji.mjs` zamienia go na:
 *  - jeden mały indeks (`indeks.json`): lista województw, posortowane unikalne nazwy miejscowości i maski województw dla każdej nazwy,
 *  - po jednym pliku na województwo z pełnymi rekordami zapisanymi kolumnowo (tabele powtarzalnych tekstów).
 * Dzięki temu podpowiedzi korzystają wyłącznie z indeksu, a pełne rekordy wczytywane są tylko dla województw, których dotyczy wybrana nazwa.
 */

export const wersjaFormatuKatalogu = 1
export const maksymalnaLiczbaWojewodztwWKatalogu = 30

export type OpisWojewodztwaKatalogu = {
  /** Techniczny kod (pierwszy człon pola `wojewodztwo`). Stabilny, bo uczestniczy w maskach. */
  kod: string
  /** Nazwa pliku z rekordami, zawiera skrót treści, dzięki czemu zmiana danych omija pamięć podręczną. */
  plik: string
  liczba: number
}

export type PlikIndeksuKatalogu = {
  wersja: typeof wersjaFormatuKatalogu
  wojewodztwa: OpisWojewodztwaKatalogu[]
  /** Unikalne nazwy posortowane alfabetycznie (kolacja polska). */
  nazwy: string[]
  /** Dla każdej nazwy maska bitowa województw (bit i = i-te województwo z listy), w których występuje. */
  maski: number[]
}

type WierszKatalogu = [
  klucz: string,
  nazwa: string,
  wojewodztwo: number,
  rodzaj: string,
  gmina: number,
  powiat: number,
  miejscownik: string,
  status: 0 | 1,
]

export type PlikWojewodztwaKatalogu = {
  wersja: typeof wersjaFormatuKatalogu
  kod: string
  tabele: { wojewodztwa: string[]; gminy: string[]; powiaty: string[] }
  wiersze: WierszKatalogu[]
}

export type KatalogStatyczny = {
  indeks: PlikIndeksuKatalogu
  pliki: Map<string, PlikWojewodztwaKatalogu>
}

const kolatorPolski = new Intl.Collator('pl')

/** Kod pliku województwa. Rekordy łączone (np. „dolnośląskie lubelskie”) trafiają do pliku pierwszego członu. */
export function pobierzKodWojewodztwa(wojewodztwo: string) {
  return wojewodztwo.trim().split(/\s+/)[0] || 'inne'
}

/** Nazwa pliku tylko z ASCII, aby ścieżki działały jednakowo w przeglądarce, WebView i serwerach statycznych. */
function utworzSlugPliku(kod: string) {
  return kod.replace(/ł/g, 'l').replace(/Ł/g, 'L').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9-]+/g, '_') || 'inne'
}

function utworzTabele() {
  const wartosci: string[] = []
  const indeksy = new Map<string, number>()
  return {
    wartosci,
    dodaj(wartosc: string) {
      const istniejacy = indeksy.get(wartosc)
      if (istniejacy !== undefined) return istniejacy
      indeksy.set(wartosc, wartosci.length)
      wartosci.push(wartosc)
      return wartosci.length - 1
    },
  }
}

/** Prosty, deterministyczny skrót treści (FNV-1a) do nazw plików. Nie służy bezpieczeństwu. */
export function policzSkrotTresci(tresc: string) {
  let skrot = 0x811c9dc5
  for (let indeks = 0; indeks < tresc.length; indeks += 1) {
    skrot ^= tresc.charCodeAt(indeks)
    skrot = Math.imul(skrot, 0x01000193)
  }
  return (skrot >>> 0).toString(16).padStart(8, '0')
}

export function zbudujKatalogStatyczny(lokalizacje: readonly Lokalizacja[]): KatalogStatyczny {
  const grupy = new Map<string, Lokalizacja[]>()
  lokalizacje.forEach((lokalizacja) => {
    const kod = pobierzKodWojewodztwa(lokalizacja.wojewodztwo)
    const grupa = grupy.get(kod)
    if (grupa) grupa.push(lokalizacja)
    else grupy.set(kod, [lokalizacja])
  })

  const kody = [...grupy.keys()].sort(kolatorPolski.compare)
  if (kody.length > maksymalnaLiczbaWojewodztwWKatalogu) {
    throw new Error(`Katalog lokalizacji ma ${kody.length} grup województw, a maski bitowe obsługują ${maksymalnaLiczbaWojewodztwWKatalogu}.`)
  }

  const pliki = new Map<string, PlikWojewodztwaKatalogu>()
  const maskiNazw = new Map<string, number>()

  kody.forEach((kod, numer) => {
    const wojewodztwa = utworzTabele()
    const gminy = utworzTabele()
    const powiaty = utworzTabele()
    const wiersze: WierszKatalogu[] = (grupy.get(kod) ?? []).map((lokalizacja) => {
      maskiNazw.set(lokalizacja.nazwa, (maskiNazw.get(lokalizacja.nazwa) ?? 0) | (1 << numer))
      return [
        lokalizacja.klucz_lokalizacji,
        lokalizacja.nazwa,
        wojewodztwa.dodaj(lokalizacja.wojewodztwo),
        lokalizacja.rodzaj,
        gminy.dodaj(lokalizacja.gmina),
        powiaty.dodaj(lokalizacja.powiat),
        lokalizacja.miejscownik_pelny_auto,
        lokalizacja.status_odmiany ? 1 : 0,
      ]
    })
    pliki.set(kod, {
      wersja: wersjaFormatuKatalogu,
      kod,
      tabele: { wojewodztwa: wojewodztwa.wartosci, gminy: gminy.wartosci, powiaty: powiaty.wartosci },
      wiersze,
    })
  })

  const nazwy = [...maskiNazw.keys()].sort(kolatorPolski.compare)

  return {
    pliki,
    indeks: {
      wersja: wersjaFormatuKatalogu,
      wojewodztwa: kody.map((kod) => ({
        kod,
        plik: `${utworzSlugPliku(kod)}.${policzSkrotTresci(JSON.stringify(pliki.get(kod)))}.json`,
        liczba: pliki.get(kod)?.wiersze.length ?? 0,
      })),
      nazwy,
      maski: nazwy.map((nazwa) => maskiNazw.get(nazwa) ?? 0),
    },
  }
}

function czyTekst(wartosc: unknown): wartosc is string {
  return typeof wartosc === 'string'
}

/** Sprawdza strukturę pliku indeksu i zwraca go albo zgłasza czytelny błąd (uszkodzony lub nieobsługiwany plik). */
export function sprawdzPlikIndeksuKatalogu(dane: unknown): PlikIndeksuKatalogu {
  const kandydat = dane as Partial<PlikIndeksuKatalogu> | null
  if (
    !kandydat || kandydat.wersja !== wersjaFormatuKatalogu || !Array.isArray(kandydat.wojewodztwa) || !Array.isArray(kandydat.nazwy) ||
    !Array.isArray(kandydat.maski) || kandydat.nazwy.length !== kandydat.maski.length || !kandydat.nazwy.every(czyTekst) ||
    !kandydat.wojewodztwa.every((opis) => opis && czyTekst(opis.kod) && czyTekst(opis.plik))
  ) {
    throw new Error('Indeks katalogu lokalizacji ma nieprawidłowy format.')
  }
  return kandydat as PlikIndeksuKatalogu
}

export function rozpakujPlikWojewodztwa(plik: PlikWojewodztwaKatalogu): Lokalizacja[] {
  if (!plik || plik.wersja !== wersjaFormatuKatalogu || !Array.isArray(plik.wiersze) || !plik.tabele) {
    throw new Error('Plik województwa w katalogu lokalizacji ma nieprawidłowy format.')
  }
  const { wojewodztwa, gminy, powiaty } = plik.tabele
  return plik.wiersze.map(([klucz, nazwa, wojewodztwo, rodzaj, gmina, powiat, miejscownik, status]) => ({
    klucz_lokalizacji: klucz,
    nazwa,
    wojewodztwo: wojewodztwa[wojewodztwo] ?? '',
    rodzaj,
    gmina: gminy[gmina] ?? '',
    powiat: powiaty[powiat] ?? '',
    miejscownik_pelny_auto: miejscownik,
    status_odmiany: status === 1,
  }))
}
