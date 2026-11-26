export const domyslnyLimitPodpowiedziMiejscowosci = 50

export type PodpowiedziMiejscowosci = {
  /** Nazwy zaczynające się od wpisanej frazy, alfabetycznie. */
  poczatek: string[]
  /** Nazwy zawierające frazę, ale nie zaczynające się od niej, alfabetycznie. Pokazywane po separatorze. */
  zawierajace: string[]
}

export const brakPodpowiedziMiejscowosci: PodpowiedziMiejscowosci = { poczatek: [], zawierajace: [] }

export function normalizujFrazeMiejscowosci(fraza: string) {
  return fraza.trim().toLocaleLowerCase('pl')
}

/**
 * Wybiera podpowiedzi miejscowości: najpierw nazwy zaczynające się od frazy, potem takie, które ją tylko zawierają.
 * Obie grupy zachowują kolejność wejścia, więc przy liście posortowanej alfabetycznie są posortowane alfabetycznie.
 * Limit dotyczy łącznej liczby wyników, a grupa „zaczyna się” ma pierwszeństwo przy jego wyczerpaniu.
 * Pusta fraza zwraca pierwsze nazwy listy jako „początek”.
 */
export function wybierzPodpowiedziMiejscowosci(
  nazwy: readonly string[],
  nazwyMale: readonly string[],
  fraza: string,
  limit = domyslnyLimitPodpowiedziMiejscowosci,
): PodpowiedziMiejscowosci {
  const szukana = normalizujFrazeMiejscowosci(fraza)
  const poczatek: string[] = []
  const zawierajace: string[] = []

  if (!szukana) {
    return { poczatek: nazwy.slice(0, limit), zawierajace }
  }

  for (let indeks = 0; indeks < nazwyMale.length && poczatek.length < limit; indeks += 1) {
    const pozycja = nazwyMale[indeks].indexOf(szukana)
    if (pozycja === 0) {
      poczatek.push(nazwy[indeks])
    } else if (pozycja > 0 && zawierajace.length < limit) {
      zawierajace.push(nazwy[indeks])
    }
  }

  return { poczatek, zawierajace: zawierajace.slice(0, Math.max(0, limit - poczatek.length)) }
}
