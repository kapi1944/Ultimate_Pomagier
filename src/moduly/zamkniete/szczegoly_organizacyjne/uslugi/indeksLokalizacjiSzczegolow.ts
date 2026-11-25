import type { Lokalizacja } from '../../../../kartoteki/lokalizacje/typyLokalizacji'

export function zbudujIndeksLokalizacjiSzczegolow(lokalizacje: Lokalizacja[]) {
  const migawka = lokalizacje.map((lokalizacja) => ({ ...lokalizacja }))
  const wedlugNazwy = new Map<string, Lokalizacja | null>()
  const wpisy = migawka.map((lokalizacja) => {
    const nazwa = lokalizacja.nazwa.toLocaleLowerCase('pl')
    wedlugNazwy.set(nazwa, wedlugNazwy.has(nazwa) ? null : lokalizacja)
    return { nazwa, lokalizacja }
  })

  return {
    /** Lista, z której zbudowano indeks (ta sama referencja, bez kopii). */
    zrodlo: lokalizacje,
    czyAktualny(nastepne: Lokalizacja[]) {
      return nastepne.length === migawka.length && nastepne.every((lokalizacja, indeks) => {
        const poprzednia = migawka[indeks]
        return (Object.keys(poprzednia) as Array<keyof Lokalizacja>).every((pole) => lokalizacja[pole] === poprzednia[pole])
      })
    },
    znajdz(miejsce: string) {
      const miastoZAdresu = miejsce.match(/\b\d{2}-\d{3}\s+([^,\n]+)\s*$/)?.[1]
      const nazwa = (miastoZAdresu ?? miejsce).trim().toLocaleLowerCase('pl')
      return nazwa ? wedlugNazwy.get(nazwa) ?? null : null
    },
    podpowiedz(miejsce: string) {
      const fraza = miejsce.trim().toLocaleLowerCase('pl')
      const wynik: Lokalizacja[] = []
      for (const wpis of wpisy) {
        if (!fraza || wpis.nazwa.includes(fraza)) wynik.push(wpis.lokalizacja)
        if (wynik.length === 50) break
      }
      return wynik
    },
  }
}

export type IndeksLokalizacjiSzczegolow = ReturnType<typeof zbudujIndeksLokalizacjiSzczegolow>

let wspolnyIndeks: IndeksLokalizacjiSzczegolow | null = null

/**
 * Indeks dla wszystkich formularzy jest budowany raz na wersję kartoteki. Lista z `pobierzLokalizacjeZMagazynu` jest współdzielona
 * i niemodyfikowalna, więc ta sama referencja oznacza te same dane. Ponowne wejście w widok nie klonuje już 70 tys. rekordów.
 */
export function pobierzWspolnyIndeksLokalizacji(lokalizacje: Lokalizacja[]): IndeksLokalizacjiSzczegolow {
  if (wspolnyIndeks?.zrodlo !== lokalizacje) {
    wspolnyIndeks = zbudujIndeksLokalizacjiSzczegolow(lokalizacje)
  }

  return wspolnyIndeks
}

/** Zwraca `obecny`, gdy dane się nie zmieniły. Przy tej samej referencji listy pomija porównywanie rekordów pole po polu. */
export function odswiezIndeksLokalizacji(obecny: IndeksLokalizacjiSzczegolow, lokalizacje: Lokalizacja[]): IndeksLokalizacjiSzczegolow {
  if (obecny.zrodlo === lokalizacje || obecny.czyAktualny(lokalizacje)) {
    return obecny
  }

  return pobierzWspolnyIndeksLokalizacji(lokalizacje)
}
