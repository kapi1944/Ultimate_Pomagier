import type { Uzytkownik } from '../../kartoteki/uzytkownicy/typyUzytkownikow'
import { czyKontoJestAktywne } from '../../kartoteki/uzytkownicy/typyUzytkownikow'
import type { WidokNawigacji } from '../nawigacja/typyNawigacji'

export type CelWyszukiwania = { widok: WidokNawigacji; rekordId?: string; akcja?: 'dodaj'; dokumentId?: string }
export type WynikWyszukiwania = { id: string; kategoria: string; nazwa: string; opis: string; informacje: string; cel: CelWyszukiwania }
export type KontekstWyszukiwania = { uzytkownik: Uzytkownik; sygnal: AbortSignal; fraza?: string; rekordId?: string; limit?: number }
export type ZrodloWyszukiwania = {
  id: string
  czyDostepne: (uzytkownik: Uzytkownik) => boolean
  pobierz: (kontekst: KontekstWyszukiwania) => Promise<WynikWyszukiwania[]>
  polecenia?: boolean
}

export function normalizujFraze(tekst: string) {
  return tekst.toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('ł', 'l').trim()
}

function czyJednaLiterowka(pierwszy: string, drugi: string) {
  if (Math.abs(pierwszy.length - drugi.length) > 1) return false
  let pozycja = 0
  while (pozycja < Math.min(pierwszy.length, drugi.length) && pierwszy[pozycja] === drugi[pozycja]) pozycja++
  if (pozycja === Math.min(pierwszy.length, drugi.length)) return true
  if (pierwszy.length === drugi.length) {
    return pierwszy.slice(pozycja + 1) === drugi.slice(pozycja + 1)
      || (pierwszy[pozycja] === drugi[pozycja + 1] && pierwszy[pozycja + 1] === drugi[pozycja] && pierwszy.slice(pozycja + 2) === drugi.slice(pozycja + 2))
  }
  return pierwszy.length > drugi.length ? pierwszy.slice(pozycja + 1) === drugi.slice(pozycja) : pierwszy.slice(pozycja) === drugi.slice(pozycja + 1)
}

export function ocenDopasowanie(wynik: WynikWyszukiwania, fraza: string) {
  const nazwa = normalizujFraze(wynik.nazwa)
  const tekst = normalizujFraze(`${wynik.nazwa} ${wynik.opis} ${wynik.informacje}`)
  const slowa = tekst.split(/[^a-z0-9]+/)
  const czesci = normalizujFraze(fraza).slice(0, 160).split(/\s+/).filter(Boolean)
  if (!czesci.length) return 1
  let punkty = 0
  for (const czesc of czesci) {
    if (nazwa === czesc) punkty += 100
    else if (nazwa.startsWith(czesc)) punkty += 80
    else if (nazwa.includes(czesc)) punkty += 60
    else if (tekst.includes(czesc)) punkty += 30
    else if (czesc.length >= 4 && slowa.some((slowo) => czyJednaLiterowka(czesc, slowo))) punkty += 10
    else return 0
  }
  return punkty
}

export function utworzWyszukiwarke(zrodlaPoczatkowe: ZrodloWyszukiwania[] = []) {
  const zrodla = new Map(zrodlaPoczatkowe.map((zrodlo) => [zrodlo.id, zrodlo]))
  return {
    zarejestruj(zrodlo: ZrodloWyszukiwania) { zrodla.set(zrodlo.id, zrodlo); return () => { if (zrodla.get(zrodlo.id) === zrodlo) zrodla.delete(zrodlo.id) } },
    async znajdzPoId(id: string, kontekst: KontekstWyszukiwania) {
      if (!czyKontoJestAktywne(kontekst.uzytkownik)) return null
      for (const zrodlo of zrodla.values()) {
        kontekst.sygnal.throwIfAborted()
        if (!zrodlo.czyDostepne(kontekst.uzytkownik)) continue
        try {
          const wynik = (await zrodlo.pobierz({ ...kontekst, rekordId: id, limit: 1 })).find((rekord) => rekord.id === id)
          kontekst.sygnal.throwIfAborted()
          if (wynik) return wynik
        } catch (blad) {
          kontekst.sygnal.throwIfAborted()
          console.error('Nie udało się odczytać wyniku wyszukiwania', zrodlo.id, blad)
        }
      }
      return null
    },
    async szukaj(fraza: string, kontekst: KontekstWyszukiwania, ostatnie: string[] = []) {
      const grupy: { kategoria: string; wyniki: WynikWyszukiwania[] }[] = []
      const bledy: string[] = []
      const polecenia = fraza.trimStart().startsWith('+')
      const zapytanie = polecenia ? fraza.trimStart().slice(1).trim() : fraza.trim()
      let ograniczonyDostep = false
      if (!czyKontoJestAktywne(kontekst.uzytkownik)) return { grupy, bledy, ograniczonyDostep: true }
      for (const zrodlo of zrodla.values()) {
        kontekst.sygnal.throwIfAborted()
        if (!zrodlo.czyDostepne(kontekst.uzytkownik)) { ograniczonyDostep = true; continue }
        if (Boolean(zrodlo.polecenia) !== polecenia || (!zapytanie && !polecenia && !ostatnie.length)) continue
        try {
          const rekordy = await zrodlo.pobierz({ ...kontekst, fraza: zapytanie, limit: 5 })
          const najlepsze = new Map<string, { wynik: WynikWyszukiwania; punkty: number }[]>()
          for (let indeks = 0; indeks < rekordy.length; indeks++) {
            if (indeks % 250 === 0) { await new Promise((wznow) => setTimeout(wznow, 0)); kontekst.sygnal.throwIfAborted() }
            const wynik = rekordy[indeks]
            if (!zapytanie && !polecenia && !ostatnie.includes(wynik.id)) continue
            const punkty = !zapytanie && !polecenia ? 100 - ostatnie.indexOf(wynik.id) : ocenDopasowanie(wynik, zapytanie)
            if (!punkty) continue
            const lista = najlepsze.get(wynik.kategoria) ?? []
            lista.push({ wynik, punkty })
            lista.sort((pierwszy, drugi) => drugi.punkty - pierwszy.punkty || pierwszy.wynik.nazwa.localeCompare(drugi.wynik.nazwa, 'pl'))
            najlepsze.set(wynik.kategoria, lista.slice(0, 5))
          }
          for (const [kategoria, wyniki] of najlepsze) {
            const grupa = grupy.find((pozycja) => pozycja.kategoria === kategoria)
            const wspolne = [...(grupa?.wyniki ?? []), ...wyniki.map(({ wynik }) => wynik)]
              .filter((wynik, indeks, lista) => lista.findIndex((rekord) => rekord.id === wynik.id) === indeks)
              .sort((pierwszy, drugi) => ocenDopasowanie(drugi, zapytanie) - ocenDopasowanie(pierwszy, zapytanie))
              .slice(0, 5)
            if (grupa) grupa.wyniki = wspolne
            else grupy.push({ kategoria, wyniki: wspolne })
          }
        } catch (blad) {
          kontekst.sygnal.throwIfAborted()
          console.error('Błąd źródła wyszukiwania', zrodlo.id, blad)
          bledy.push(zrodlo.id)
        }
      }
      kontekst.sygnal.throwIfAborted()
      return { grupy, bledy, ograniczonyDostep }
    },
  }
}

const prefiksHistorii = 'ultimatePomagier.wyszukiwanie.v1.'
export function pobierzHistorieWyszukiwania(uzytkownikId: string): string[] {
  try {
    const zapis: unknown = JSON.parse(localStorage.getItem(prefiksHistorii + encodeURIComponent(uzytkownikId)) ?? '[]')
    return Array.isArray(zapis) ? [...new Set(zapis.filter((id): id is string => typeof id === 'string' && id.length < 300))].slice(0, 10) : []
  } catch { return [] }
}
export function zapiszOtwartyWynik(uzytkownikId: string, wynikId: string) {
  try {
    localStorage.setItem(prefiksHistorii + encodeURIComponent(uzytkownikId), JSON.stringify([wynikId, ...pobierzHistorieWyszukiwania(uzytkownikId).filter((id) => id !== wynikId)].slice(0, 10)))
    return true
  } catch { return false }
}

export function pobierzParametrTrasyWyszukiwania(nazwa: string) {
  return typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(nazwa)
}
