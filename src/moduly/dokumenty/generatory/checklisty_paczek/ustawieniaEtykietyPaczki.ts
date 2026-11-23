import { utworzKategorieDomyslne, utworzPozycjeDomyslne } from './modelChecklistyPaczki'

export type RodzajEtykiety = 'szkoleniowa' | 'uniwersalna'
export type ZageszczenieEtykiety = 'standard' | 'kompakt' | 'maksymalny'
export type DopasowanieEtykiety = 'automatyczne' | ZageszczenieEtykiety
export type PozycjaUniwersalnejEtykiety = { id: string; nazwa: string; ilosc: number | null; czyUkryta: boolean }
export const nazwyPolEtykiety = {
  logo: 'Logo', numer: 'Numer paczki', kod: 'Kod szkolenia', tytul: 'Tytuł szkolenia', termin: 'Termin',
  grupa: 'Grupa', uczestnicy: 'Liczba uczestników', miejsce: 'Miejsce', trenerzy: 'Trenerzy', uwagi: 'Uwagi dodatkowe',
} as const
export type PoleEtykiety = keyof typeof nazwyPolEtykiety
export type UstawieniaEtykiety = {
  rodzaj: RodzajEtykiety
  dopasowanie: DopasowanieEtykiety
  tryb: 'termiczny' | 'kolorowy'
  wymiary: { szerokosc: number; wysokosc: number }
  pola: Record<PoleEtykiety, boolean>
  pozycjeUniwersalne: PozycjaUniwersalnejEtykiety[]
  szablon: string
}

export function utworzUstawieniaEtykiety(rodzaj: RodzajEtykiety = 'szkoleniowa'): UstawieniaEtykiety {
  // Nazwy podstawowych materiałów pochodzą z tego samego katalogu co checklista.
  const nazwy = [...utworzPozycjeDomyslne(utworzKategorieDomyslne(), false).map((pozycja) => pozycja.nazwa), 'Program szkolenia', 'Materiały promocyjne']
  return {
    rodzaj, dopasowanie: 'automatyczne', tryb: 'termiczny', wymiary: { szerokosc: 100, wysokosc: 150 },
    pola: { logo: true, numer: true, kod: true, tytul: true, termin: false, grupa: false, uczestnicy: false, miejsce: false, trenerzy: false, uwagi: false },
    pozycjeUniwersalne: nazwy.map((nazwa, indeks) => ({ id: `material-uniwersalny-${indeks}`, nazwa, ilosc: null, czyUkryta: false })),
    szablon: rodzaj === 'uniwersalna' ? 'uniwersalny' : 'standard',
  }
}

export function normalizujUstawieniaEtykiety(wartosc: unknown): UstawieniaEtykiety {
  const domyslne = utworzUstawieniaEtykiety()
  if (!wartosc || typeof wartosc !== 'object') return domyslne
  const zapis = wartosc as Partial<UstawieniaEtykiety>
  const pola = { ...domyslne.pola }
  for (const pole of Object.keys(pola) as PoleEtykiety[]) if (typeof zapis.pola?.[pole] === 'boolean') pola[pole] = zapis.pola[pole]
  const identyfikatory = new Set<string>()
  const pozycje = Array.isArray(zapis.pozycjeUniwersalne) ? zapis.pozycjeUniwersalne.flatMap((pozycja) => {
    if (!pozycja || typeof pozycja.id !== 'string' || !pozycja.id || identyfikatory.has(pozycja.id) || typeof pozycja.nazwa !== 'string') return []
    identyfikatory.add(pozycja.id)
    return [{ id: pozycja.id, nazwa: pozycja.nazwa, czyUkryta: pozycja.czyUkryta === true,
      ilosc: typeof pozycja.ilosc === 'number' && Number.isSafeInteger(pozycja.ilosc) && pozycja.ilosc >= 0 ? pozycja.ilosc : null }]
  }) : domyslne.pozycjeUniwersalne
  const wymiary = zapis.wymiary
  return {
    rodzaj: zapis.rodzaj === 'uniwersalna' ? 'uniwersalna' : 'szkoleniowa',
    dopasowanie: ['standard', 'kompakt', 'maksymalny'].includes(zapis.dopasowanie ?? '') ? zapis.dopasowanie! : 'automatyczne',
    tryb: zapis.tryb === 'kolorowy' ? 'kolorowy' : 'termiczny',
    wymiary: wymiary && Number.isFinite(wymiary.szerokosc) && wymiary.szerokosc >= 88 && wymiary.szerokosc <= 220
      && Number.isFinite(wymiary.wysokosc) && wymiary.wysokosc >= 80 && wymiary.wysokosc <= 320 ? { ...wymiary } : domyslne.wymiary,
    pola, pozycjeUniwersalne: pozycje, szablon: typeof zapis.szablon === 'string' ? zapis.szablon : domyslne.szablon,
  }
}

export const komunikatPrzepelnieniaEtykiety = 'Nie wszystkie pozycje mieszczą się na etykiecie. Zmień format, ogranicz informacje dodatkowe lub wybierz osobną checklistę.'
