import {
  pobierzMaskeZaladowanychWojewodztw,
  pobierzZaladowanyIndeksKatalogu,
  type IndeksKataloguLokalizacji,
} from '../../../../kartoteki/lokalizacje/ladowanieKatalogu'
import { pobierzLokalizacjeZMagazynu, podpowiedzMiejscowosci } from '../../../../kartoteki/lokalizacje/magazynLokalizacji'
import type { Lokalizacja } from '../../../../kartoteki/lokalizacje/typyLokalizacji'
import { normalizujFrazeMiejscowosci, type PodpowiedziMiejscowosci } from '../../../../kartoteki/lokalizacje/wyszukiwanieMiejscowosci'

/** Nazwa miejscowości (małymi literami) z pola „Miejsce”: samo miasto albo miasto z końca adresu z kodem pocztowym. */
export function pobierzNazweZMiejsca(miejsce: string) {
  const miastoZAdresu = miejsce.match(/\b\d{2}-\d{3}\s+([^,\n]+)\s*$/)?.[1]
  return normalizujFrazeMiejscowosci(miastoZAdresu ?? miejsce)
}

type StanKatalogu ={ katalog: IndeksKataloguLokalizacji; zaladowaneWojewodztwa: number }

/**
 * Indeks lokalizacji formularza Szczegółów.
 *
 * `znajdz` zwraca lokalizację tylko wtedy, gdy nazwa jest jednoznaczna. Jednoznaczność wymaga znajomości wszystkich rekordów o tej nazwie,
 * więc dla nazwy, której województwa nie są jeszcze wczytane, wynik to `null` (do czasu wczytania; indeks jest wtedy budowany od nowa).
 * Bez `stanKatalogu` (testy, listy w pamięci) każda lista jest uznawana za kompletną.
 */
export function zbudujIndeksLokalizacjiSzczegolow(lokalizacje: Lokalizacja[], stanKatalogu?: StanKatalogu | null, pobierzPodpowiedzi: (fraza: string) => PodpowiedziMiejscowosci = podpowiedzMiejscowosci) {
  let wedlugNazwy: Map<string, Lokalizacja | null> | null = null

  function pobierzMapeNazw() {
    if (!wedlugNazwy) {
      wedlugNazwy = new Map()
      for (const lokalizacja of lokalizacje) {
        const nazwa = normalizujFrazeMiejscowosci(lokalizacja.nazwa)
        wedlugNazwy.set(nazwa, wedlugNazwy.has(nazwa) ? null : lokalizacja)
      }
    }
    return wedlugNazwy
  }

  return {
    /** Lista, z której zbudowano indeks (ta sama referencja, bez kopii). */
    zrodlo: lokalizacje,
    znajdz(miejsce: string) {
      const nazwa = pobierzNazweZMiejsca(miejsce)
      if (!nazwa) return null
      const maska = stanKatalogu?.katalog.pobierzMaske(nazwa) ?? 0
      if (maska & ~(stanKatalogu?.zaladowaneWojewodztwa ?? 0)) return null
      return pobierzMapeNazw().get(nazwa) ?? null
    },
    /** Najpierw nazwy zaczynające się od frazy, potem zawierające ją (alfabetycznie, łącznie do 50). */
    podpowiedz(miejsce: string): PodpowiedziMiejscowosci {
      return pobierzPodpowiedzi(miejsce)
    },
  }
}

export type IndeksLokalizacjiSzczegolow = ReturnType<typeof zbudujIndeksLokalizacjiSzczegolow>

let wspolnyIndeks: { indeks: IndeksLokalizacjiSzczegolow; lokalizacje: Lokalizacja[]; zaladowaneWojewodztwa: number; katalog: IndeksKataloguLokalizacji | null } | null = null

/**
 * Indeks dla wszystkich formularzy jest budowany raz na stan danych: listę lokalizacji w pamięci (zmienia się przy zmianie zapisu
 * użytkownika albo wczytaniu województwa) i zestaw wczytanych województw. Niezmieniony stan zwraca ten sam obiekt, więc nie wywołuje
 * ponownej walidacji ani renderowania kart grup. Sam indeks nazw ma znaczenie dla wyniku tylko wtedy, gdy są zmiany użytkownika.
 */
export function pobierzWspolnyIndeksLokalizacji(): IndeksLokalizacjiSzczegolow {
  const lokalizacje = pobierzLokalizacjeZMagazynu()
  const zaladowaneWojewodztwa = pobierzMaskeZaladowanychWojewodztw()
  const katalog = lokalizacje.length > 0 ? pobierzZaladowanyIndeksKatalogu() : null

  if (wspolnyIndeks?.lokalizacje !== lokalizacje || wspolnyIndeks.zaladowaneWojewodztwa !== zaladowaneWojewodztwa || wspolnyIndeks.katalog !== katalog) {
    wspolnyIndeks = {
      indeks: zbudujIndeksLokalizacjiSzczegolow(lokalizacje, { katalog: katalog ?? pustyKatalog, zaladowaneWojewodztwa }),
      lokalizacje,
      zaladowaneWojewodztwa,
      katalog,
    }
  }

  return wspolnyIndeks.indeks
}

// Dopóki katalog nie jest wczytany, nie wiadomo, które nazwy są jednoznaczne, więc `znajdz` niczego nie rozpoznaje poza zmianami użytkownika.
const pustyKatalog: IndeksKataloguLokalizacji = {
  plik: { wersja: 1, wojewodztwa: [], nazwy: [], maski: [] },
  nazwy: [],
  nazwyMale: [],
  pobierzMaske: () => undefined,
}
