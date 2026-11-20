import type { LokalizacjaMagazynowa, LokalizacjaMapy, StanWLokalizacji, WygladMebla } from '../modele/zakupy'
import { normalizujLokalizacjeMapy, uporzadkujLokalizacje } from './mapaMagazynu'

/**
 * Widok elewacji (front ściany z regałami i szafami). Czysta logika bez Reacta.
 * Układ poziomy bierze z istniejącej geometrii mebla (`polozenieNaMapie.x` i `.szerokosc`, w % planu strefy),
 * a półki z dzieci mebla. Numeracja półek: najniższa ma najniższą `kolejnosc` (PL-01 = od dołu).
 */
export type PolkaElewacji = { id: string; kod: string; pelnyKod: string; nazwa: string; sekcja: number; poziom: number; czyAktywna: boolean }
export type SekcjaElewacji = { numer: number; polki: PolkaElewacji[] }
export type MeblElewacji = {
  id: string; kod: string; pelnyKod: string; nazwa: string; rodzaj: WygladMebla['rodzaj']; czyAktywny: boolean
  x: number; szerokosc: number; sekcje: SekcjaElewacji[]; liczbaPoziomow: number
}

export function znajdzStrefyElewacji(lokalizacje: LokalizacjaMapy[]): LokalizacjaMapy[] {
  const strefy = new Set(lokalizacje.filter((lokalizacja) => lokalizacja.wyglad && lokalizacja.nadrzednaLokalizacjaId).map((lokalizacja) => lokalizacja.nadrzednaLokalizacjaId))
  return uporzadkujLokalizacje(lokalizacje.filter((lokalizacja) => strefy.has(lokalizacja.id)))
}

export function zbudujElewacje(lokalizacje: LokalizacjaMapy[], strefaId: string): MeblElewacji[] {
  const meble = uporzadkujLokalizacje(lokalizacje.filter((lokalizacja) => lokalizacja.nadrzednaLokalizacjaId === strefaId && lokalizacja.wyglad))
  const czyWszystkieNaPlanie = meble.every((mebel) => mebel.polozenieNaMapie)
  const ulozone = (czyWszystkieNaPlanie
    ? [...meble].sort((pierwszy, drugi) => pierwszy.polozenieNaMapie!.x - drugi.polozenieNaMapie!.x)
    : meble)
  return ulozone.map((mebel, indeks) => {
    const polki = uporzadkujLokalizacje(lokalizacje.filter((lokalizacja) => lokalizacja.nadrzednaLokalizacjaId === mebel.id && lokalizacja.typ === 'POLKA'))
    const liczbaSekcji = Math.max(mebel.wyglad!.sekcje, ...polki.map((polka) => polka.sekcja ?? 1))
    const sekcje = Array.from({ length: liczbaSekcji }, (_, numerIndeks): SekcjaElewacji => ({
      numer: numerIndeks + 1,
      polki: polki.filter((polka) => (polka.sekcja ?? 1) === numerIndeks + 1).map((polka, poziom) => ({
        id: polka.id, kod: polka.kod, pelnyKod: polka.pelnyKod, nazwa: polka.nazwa, sekcja: numerIndeks + 1, poziom, czyAktywna: polka.czyAktywna,
      })),
    }))
    const geometria = czyWszystkieNaPlanie ? mebel.polozenieNaMapie! : { x: indeks * (100 / ulozone.length), szerokosc: 100 / ulozone.length }
    return {
      id: mebel.id, kod: mebel.kod, pelnyKod: mebel.pelnyKod, nazwa: mebel.nazwa, rodzaj: mebel.wyglad!.rodzaj, czyAktywny: mebel.czyAktywna,
      x: geometria.x, szerokosc: geometria.szerokosc, sekcje, liczbaPoziomow: Math.max(1, ...sekcje.map((sekcja) => sekcja.polki.length)),
    }
  })
}

export function policzPozycjeNaPolce(stany: StanWLokalizacji[], lokalizacjaId: string) {
  return stany.filter((stan) => stan.lokalizacjaId === lokalizacjaId && stan.ilosc > 0).length
}

type SzablonMebla = { kod: string; nazwa: string; rodzaj: WygladMebla['rodzaj']; sekcje: number; polkiNaSekcje: number; x: number; szerokosc: number }

/**
 * Roboczy układ lewej ściany odtworzony ze zdjęć/makiety: od lewej REG-01 (2 sekcje), REG-02 (wąski),
 * REG-03, REG-04 i szafa SZ-01. Liczby półek są wartościami wyjściowymi do korekty w edytorze.
 */
export const ukladLewejSciany: SzablonMebla[] = [
  { kod: 'REG-01', nazwa: 'Regał 1', rodzaj: 'REGAL', sekcje: 2, polkiNaSekcje: 5, x: 0, szerokosc: 33 },
  { kod: 'REG-02', nazwa: 'Regał 2', rodzaj: 'REGAL', sekcje: 1, polkiNaSekcje: 9, x: 33.5, szerokosc: 11.5 },
  { kod: 'REG-03', nazwa: 'Regał 3', rodzaj: 'REGAL', sekcje: 1, polkiNaSekcje: 5, x: 45.5, szerokosc: 17 },
  { kod: 'REG-04', nazwa: 'Regał 4', rodzaj: 'REGAL', sekcje: 1, polkiNaSekcje: 5, x: 63, szerokosc: 17 },
  { kod: 'SZ-01', nazwa: 'Szafa 1', rodzaj: 'SZAFA', sekcje: 1, polkiNaSekcje: 4, x: 80.5, szerokosc: 19.5 },
]

export type WynikUkladuLewejSciany = { lokalizacje: LokalizacjaMapy[]; strefaId: string; dodano: string[]; pominieto: string[] }

const dopelnij = (numer: number) => String(numer).padStart(2, '0')

/**
 * Dopisuje MAG › L › meble › półki. Nie zmienia istniejących rekordów: istniejący MAG i L są użyte ponownie,
 * a mebel o tym samym kodzie w strefie L zostaje pominięty. Wynik trzeba jeszcze zapisać przyciskiem „Zapisz konfigurację”.
 */
export function dodajUkladLewejSciany(lokalizacje: LokalizacjaMapy[], szablony: SzablonMebla[] = ukladLewejSciany): WynikUkladuLewejSciany {
  const nowe: LokalizacjaMagazynowa[] = []
  const wszystkie = () => [...lokalizacje, ...nowe]
  const nastepnaKolejnosc = (rodzicId?: string) => Math.max(-1, ...wszystkie().filter((lokalizacja) => lokalizacja.nadrzednaLokalizacjaId === rodzicId).map((lokalizacja) => lokalizacja.kolejnosc ?? 0)) + 1
  const korzen = lokalizacje.find((lokalizacja) => !lokalizacja.nadrzednaLokalizacjaId && lokalizacja.kod === 'MAG')
  if (!korzen) {
    const rekord: LokalizacjaMagazynowa = { id: crypto.randomUUID(), nazwa: 'Magazyn', kod: 'MAG', typ: 'OBIEKT', czyAktywna: true, kolejnosc: nastepnaKolejnosc(undefined), polozenieNaMapie: { x: 5, y: 5, szerokosc: 90, wysokosc: 90 } }
    nowe.push(rekord)
  }
  const korzenId = korzen?.id ?? nowe[0].id
  const strefa = lokalizacje.find((lokalizacja) => lokalizacja.nadrzednaLokalizacjaId === korzenId && lokalizacja.kod === 'L')
  if (!strefa) {
    nowe.push({ id: crypto.randomUUID(), nazwa: 'Lewa strona', kod: 'L', typ: 'STREFA', nadrzednaLokalizacjaId: korzenId, czyAktywna: true, kolejnosc: nastepnaKolejnosc(korzenId), polozenieNaMapie: { x: 2, y: 5, szerokosc: 30, wysokosc: 90 } })
  }
  const strefaId = strefa?.id ?? nowe.at(-1)!.id
  const dodano: string[] = []
  const pominieto: string[] = []
  for (const szablon of szablony) {
    if (wszystkie().some((lokalizacja) => lokalizacja.nadrzednaLokalizacjaId === strefaId && lokalizacja.kod === szablon.kod)) { pominieto.push(szablon.kod); continue }
    const meblId = crypto.randomUUID()
    nowe.push({ id: meblId, nazwa: szablon.nazwa, kod: szablon.kod, typ: 'REGAL', nadrzednaLokalizacjaId: strefaId, czyAktywna: true, kolejnosc: nastepnaKolejnosc(strefaId), wyglad: { rodzaj: szablon.rodzaj, sekcje: szablon.sekcje }, polozenieNaMapie: { x: szablon.x, y: 35, szerokosc: szablon.szerokosc, wysokosc: 30 } })
    let kolejnosc = 0
    for (let sekcja = 1; sekcja <= szablon.sekcje; sekcja++) {
      for (let numer = 1; numer <= szablon.polkiNaSekcje; numer++) {
        const kod = szablon.sekcje > 1 ? `S${sekcja}-PL-${dopelnij(numer)}` : `PL-${dopelnij(numer)}`
        nowe.push({ id: crypto.randomUUID(), nazwa: szablon.sekcje > 1 ? `Sekcja ${sekcja}, półka ${numer}` : `Półka ${numer}`, kod, typ: 'POLKA', nadrzednaLokalizacjaId: meblId, czyAktywna: true, kolejnosc: kolejnosc++, ...(szablon.sekcje > 1 ? { sekcja } : {}) })
      }
    }
    dodano.push(szablon.kod)
  }
  if (!nowe.length) return { lokalizacje, strefaId, dodano, pominieto }
  return { lokalizacje: normalizujLokalizacjeMapy([...lokalizacje, ...nowe], 2), strefaId, dodano, pominieto }
}
