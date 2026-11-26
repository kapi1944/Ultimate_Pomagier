import { trenerzyKartotekiStartowi } from '../moduly/zamkniete/szczegoly_organizacyjne/stale'
import type { TrenerKartoteki } from '../moduly/zamkniete/szczegoly_organizacyjne/typy'

const kluczTrenerowKartoteki = 'ultimate-pomagier.kartoteki.trenerzy'

export function pobierzTrenerowZKartoteki(): TrenerKartoteki[] {
  try {
    const zapis = localStorage.getItem(kluczTrenerowKartoteki)
    const dane = zapis ? JSON.parse(zapis) : null

    if (!Array.isArray(dane)) {
      return trenerzyKartotekiStartowi
    }

    return dane
      .filter((trener) => trener?.status !== 'Nieaktywny')
      .map((trener) => ({
        id: String(trener.id),
        imieNazwisko: `${trener.imie ?? ''} ${trener.nazwisko ?? ''}`.trim() || String(trener.imieNazwisko ?? ''),
        telefon: String(trener.telefon ?? ''),
        email: String(trener.email ?? ''),
      }))
      .filter((trener) => trener.imieNazwisko)
  } catch {
    return trenerzyKartotekiStartowi
  }
}



export type RekordKartotekiTrenera = {
  id: string
  imie: string
  nazwisko: string
  telefon: string
  email: string
  status: 'Aktywny' | 'Nieaktywny'
}

const kluczTrenerow = 'ultimate-pomagier.kartoteki.trenerzy'
function pobierzZMagazynu<T>(klucz: string, wartoscDomyslna: T[]): T[] {
  try {
    const zapis = localStorage.getItem(klucz)
    const dane = zapis ? JSON.parse(zapis) : null

    return Array.isArray(dane) ? dane : wartoscDomyslna
  } catch {
    return wartoscDomyslna
  }
}

function pobierzKluczTrenera(trener: Pick<RekordKartotekiTrenera, 'imie' | 'nazwisko'>) {
  return normalizujTekst(`${trener.imie} ${trener.nazwisko}`)
}

function rozdzielImieNazwisko(imieNazwisko: string) {
  const czesci = imieNazwisko.trim().split(/\s+/)
  const nazwisko = czesci.length > 1 ? czesci.pop() ?? '' : ''

  return {
    imie: czesci.join(' ') || imieNazwisko,
    nazwisko,
  }
}

function przygotujTrenerowStartowych(): RekordKartotekiTrenera[] {
  return trenerzyKartotekiStartowi.map((trener) => ({
    id: trener.id,
    ...rozdzielImieNazwisko(trener.imieNazwisko),
    telefon: trener.telefon,
    email: trener.email,
    status: 'Aktywny',
  }))
}

function czyStaraBazaTrenerow(trenerzy: RekordKartotekiTrenera[]) {
  const stareId = new Set(['trener-anna-kowalska', 'trener-piotr-nowak', 'trener-marta-zielinska'])

  return trenerzy.length > 0 && trenerzy.every((trener) => stareId.has(trener.id) || trener.email.endsWith('@pomagier.local'))
}

function uzupelnijBazeTrenerow(trenerzyZMagazynu: RekordKartotekiTrenera[]) {
  const trenerzyStartowi = przygotujTrenerowStartowych()

  if (!trenerzyZMagazynu.length || czyStaraBazaTrenerow(trenerzyZMagazynu)) {
    return trenerzyStartowi
  }

  const trenerzyWedlugNazwy = new Map(trenerzyZMagazynu.map((trener) => [pobierzKluczTrenera(trener), trener]))
  const trenerzyScaleni = trenerzyZMagazynu.map((trener) => {
    const trenerStartowy = trenerzyStartowi.find((pozycja) => pobierzKluczTrenera(pozycja) === pobierzKluczTrenera(trener))

    if (!trenerStartowy) {
      return trener
    }

    return {
      ...trener,
      id: trener.id || trenerStartowy.id,
      telefon: trener.telefon || trenerStartowy.telefon,
      email: trener.email || trenerStartowy.email,
      status: trener.status || trenerStartowy.status,
    }
  })

  trenerzyStartowi.forEach((trener) => {
    if (!trenerzyWedlugNazwy.has(pobierzKluczTrenera(trener))) {
      trenerzyScaleni.push(trener)
    }
  })

  return trenerzyScaleni
}

function normalizujTekst(wartosc: string) {
  return wartosc
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}


export function pobierzPelnaKartotekeTrenerow() {
  return uzupelnijBazeTrenerow(pobierzZMagazynu(kluczTrenerow, przygotujTrenerowStartowych()))
}
