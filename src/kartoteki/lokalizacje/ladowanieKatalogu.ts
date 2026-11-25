import {
  type PlikWojewodztwaKatalogu,
  type PlikIndeksuKatalogu,
  rozpakujPlikWojewodztwa,
  sprawdzPlikIndeksuKatalogu,
} from './katalogStatyczny'
import { normalizujFrazeMiejscowosci } from './wyszukiwanieMiejscowosci'
import type { Lokalizacja } from './typyLokalizacji'

/** Źródło plików katalogu. Domyślnie HTTP (pliki statyczne aplikacji); w testach można podstawić odczyt z dysku. */
export type ZrodloKataloguLokalizacji = (nazwaPliku: string) => Promise<unknown>

export type IndeksKataloguLokalizacji = {
  plik: PlikIndeksuKatalogu
  nazwy: readonly string[]
  nazwyMale: readonly string[]
  /** Maska województw dla nazwy zapisanej małymi literami; `undefined`, gdy nazwy nie ma w katalogu startowym. */
  pobierzMaske(nazwaMala: string): number | undefined
}

const sciezkaKatalogu = 'dane/lokalizacje/'

async function pobierzPrzezHttp(nazwaPliku: string) {
  const podstawa = import.meta.env?.BASE_URL ?? '/'
  // Indeks jest sprawdzany przy każdym starcie, pliki województw mają skrót w nazwie, więc mogą być w pełni cache'owane.
  const odpowiedz = await fetch(`${podstawa}${sciezkaKatalogu}${nazwaPliku}`, nazwaPliku === 'indeks.json' ? { cache: 'no-cache' } : undefined)
  if (!odpowiedz.ok) {
    throw new Error(`Nie udało się pobrać pliku katalogu lokalizacji (${nazwaPliku}): ${odpowiedz.status}`)
  }
  return odpowiedz.json() as Promise<unknown>
}

let zrodlo: ZrodloKataloguLokalizacji = pobierzPrzezHttp
let indeks: IndeksKataloguLokalizacji | null = null
let obietnicaIndeksu: Promise<IndeksKataloguLokalizacji> | null = null
const wojewodztwaZaladowane = new Map<string, Lokalizacja[]>()
// Pobrane, ale jeszcze nieopublikowane województwa. Publikujemy je razem, aby jedno żądanie nie wywoływało kaskady odświeżeń widoków.
const wojewodztwaOczekujace = new Map<string, Lokalizacja[]>()
const obietnicaWojewodztw = new Map<string, Promise<void>>()
let wersja = 0
let wersjaDanych = 0
let ostatniBlad: Error | null = null
const sluchacze = new Set<() => void>()
let zbiorZaladowanych: { wersjaDanych: number; lokalizacje: Lokalizacja[] } | null = null

function powiadom() {
  wersja += 1
  sluchacze.forEach((sluchacz) => sluchacz())
}

function zapamietajBlad(blad: unknown) {
  ostatniBlad = blad instanceof Error ? blad : new Error(String(blad))
  // Zmiana wersji budzi widoki, aby mogły pokazać komunikat o niedostępnym katalogu.
  powiadom()
}

/** Podstawia inne źródło plików i czyści stan. Używane w testach. */
export function ustawZrodloKataloguLokalizacji(nowe: ZrodloKataloguLokalizacji | null) {
  zrodlo = nowe ?? pobierzPrzezHttp
  indeks = null
  obietnicaIndeksu = null
  wojewodztwaZaladowane.clear()
  wojewodztwaOczekujace.clear()
  obietnicaWojewodztw.clear()
  ostatniBlad = null
  zbiorZaladowanych = null
  wersjaDanych += 1
  powiadom()
}

/** Numer zmienia się przy każdym wczytaniu danych lub błędzie; służy do unieważniania pamięci podręcznych i odświeżania widoków. */
export function pobierzWersjeKataloguLokalizacji() {
  return wersja
}

/** Numer zmienia się tylko wtedy, gdy zmienił się zestaw wczytanych rekordów (nie przy wczytaniu indeksu ani błędzie). */
export function pobierzWersjeDanychKataloguLokalizacji() {
  return wersjaDanych
}

export function subskrybujKatalogLokalizacji(sluchacz: () => void) {
  sluchacze.add(sluchacz)
  return () => {
    sluchacze.delete(sluchacz)
  }
}

export function pobierzBladKataloguLokalizacji() {
  return ostatniBlad
}

function zbudujIndeks(plik: PlikIndeksuKatalogu): IndeksKataloguLokalizacji {
  const nazwyMale = plik.nazwy.map((nazwa) => normalizujFrazeMiejscowosci(nazwa))
  const maski = new Map<string, number>()
  nazwyMale.forEach((nazwaMala, numer) => {
    maski.set(nazwaMala, (maski.get(nazwaMala) ?? 0) | plik.maski[numer])
  })
  return { plik, nazwy: plik.nazwy, nazwyMale, pobierzMaske: (nazwaMala) => maski.get(nazwaMala) }
}

export function pobierzZaladowanyIndeksKatalogu() {
  return indeks
}

export function zaladujIndeksKataloguLokalizacji(): Promise<IndeksKataloguLokalizacji> {
  if (indeks) return Promise.resolve(indeks)
  if (!obietnicaIndeksu) {
    const biezaca: Promise<IndeksKataloguLokalizacji> = zrodlo('indeks.json')
      .then((dane) => {
        const nowy = zbudujIndeks(sprawdzPlikIndeksuKatalogu(dane))
        if (obietnicaIndeksu === biezaca) {
          indeks = nowy
          ostatniBlad = null
          powiadom()
        }
        return nowy
      })
      .catch((blad) => {
        // Nieudane ładowanie nie może zostać zapamiętane na stałe: kolejne wywołanie spróbuje ponownie.
        if (obietnicaIndeksu === biezaca) {
          obietnicaIndeksu = null
          zapamietajBlad(blad)
        }
        throw blad
      })
    obietnicaIndeksu = biezaca
  }
  return obietnicaIndeksu
}

/** Maska bitowa już wczytanych województw. */
export function pobierzMaskeZaladowanychWojewodztw() {
  if (!indeks) return 0
  return indeks.plik.wojewodztwa.reduce((maska, opis, numer) => (wojewodztwaZaladowane.has(opis.kod) ? maska | (1 << numer) : maska), 0)
}

export function pobierzLiczbeWojewodztwKatalogu() {
  return indeks?.plik.wojewodztwa.length ?? 0
}

function zaladujWojewodztwo(numer: number): Promise<void> {
  const opis = indeks?.plik.wojewodztwa[numer]
  if (!opis || wojewodztwaZaladowane.has(opis.kod) || wojewodztwaOczekujace.has(opis.kod)) return Promise.resolve()
  const istniejaca = obietnicaWojewodztw.get(opis.kod)
  if (istniejaca) return istniejaca
  const biezaca: Promise<void> = zrodlo(opis.plik)
    .then((dane) => {
      if (obietnicaWojewodztw.get(opis.kod) !== biezaca) return
      wojewodztwaOczekujace.set(opis.kod, rozpakujPlikWojewodztwa(dane as PlikWojewodztwaKatalogu))
      obietnicaWojewodztw.delete(opis.kod)
    })
    .catch((blad) => {
      if (obietnicaWojewodztw.get(opis.kod) === biezaca) {
        obietnicaWojewodztw.delete(opis.kod)
        zapamietajBlad(blad)
      }
      throw blad
    })
  obietnicaWojewodztw.set(opis.kod, biezaca)
  return biezaca
}

function opublikujOczekujaceWojewodztwa() {
  if (wojewodztwaOczekujace.size === 0) return
  wojewodztwaOczekujace.forEach((lokalizacje, kod) => wojewodztwaZaladowane.set(kod, lokalizacje))
  wojewodztwaOczekujace.clear()
  wersjaDanych += 1
  ostatniBlad = null
  powiadom()
}

/** Wczytuje województwa wskazane maską bitową i udostępnia je jednocześnie. Wymaga wcześniej wczytanego indeksu. */
export async function zaladujWojewodztwaPoMasce(maska: number): Promise<void> {
  const zadania: Promise<void>[] = []
  for (let numer = 0; numer < pobierzLiczbeWojewodztwKatalogu(); numer += 1) {
    if (maska & (1 << numer)) zadania.push(zaladujWojewodztwo(numer))
  }
  const wyniki = await Promise.allSettled(zadania)
  // Udane pliki zostają udostępnione także wtedy, gdy któryś inny się nie powiódł.
  opublikujOczekujaceWojewodztwa()
  const nieudane = wyniki.find((wynik): wynik is PromiseRejectedResult => wynik.status === 'rejected')
  if (nieudane) throw nieudane.reason
}

/** Wczytuje rekordy województw, w których występują podane nazwy. Nazwy spoza katalogu są pomijane. */
export async function zaladujLokalizacjeDlaNazw(nazwy: readonly string[]) {
  const dane = await zaladujIndeksKataloguLokalizacji()
  let maska = 0
  nazwy.forEach((nazwa) => {
    maska |= dane.pobierzMaske(normalizujFrazeMiejscowosci(nazwa)) ?? 0
  })
  await zaladujWojewodztwaPoMasce(maska)
}

export async function zaladujCalyKatalogLokalizacji() {
  const dane = await zaladujIndeksKataloguLokalizacji()
  await zaladujWojewodztwaPoMasce(dane.plik.wojewodztwa.reduce((maska, _opis, numer) => maska | (1 << numer), 0))
}

/** Rekordy startowe wczytanych dotąd województw. Ta sama referencja do czasu kolejnego wczytania; nie wolno jej modyfikować. */
export function pobierzZaladowaneLokalizacjeStartowe(): Lokalizacja[] {
  if (zbiorZaladowanych?.wersjaDanych === wersjaDanych) return zbiorZaladowanych.lokalizacje
  const lokalizacje = indeks ? indeks.plik.wojewodztwa.flatMap((opis) => wojewodztwaZaladowane.get(opis.kod) ?? []) : []
  zbiorZaladowanych = { wersjaDanych, lokalizacje }
  return lokalizacje
}
