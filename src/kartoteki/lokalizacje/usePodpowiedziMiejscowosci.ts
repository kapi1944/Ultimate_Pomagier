import { useEffect, useSyncExternalStore } from 'react'
import { pobierzWersjeKataloguLokalizacji, subskrybujKatalogLokalizacji, zaladujIndeksKataloguLokalizacji } from './ladowanieKatalogu'
import { podpowiedzMiejscowosci } from './magazynLokalizacji'
import type { PodpowiedziMiejscowosci } from './wyszukiwanieMiejscowosci'

/**
 * Podpowiedzi miejscowości dla wpisywanej frazy. Indeks nazw jest ładowany przy pierwszym użyciu (jest mały),
 * a widok odświeża się, gdy dane staną się dostępne.
 */
export function usePodpowiedziMiejscowosci(fraza: string): PodpowiedziMiejscowosci {
  // Subskrypcja wymusza renderowanie po wczytaniu indeksu; sam wynik jest pamiętany w `podpowiedzMiejscowosci`.
  useSyncExternalStore(subskrybujKatalogLokalizacji, pobierzWersjeKataloguLokalizacji)

  useEffect(() => {
    zaladujIndeksKataloguLokalizacji().catch((blad: unknown) => {
      console.warn('Nie udało się wczytać indeksu miejscowości. Podpowiedzi są niedostępne, ale pole można wypełnić ręcznie.', blad)
    })
  }, [])

  return podpowiedzMiejscowosci(fraza)
}
