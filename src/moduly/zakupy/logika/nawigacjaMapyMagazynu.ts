/**
 * Nawigacja po planie magazynu zapisywana w historii przeglądarki (przyciski Wstecz/Dalej,
 * boczne przyciski myszy, Alt+strzałki). Czysta logika, bez zależności od Reacta.
 * Stan trzymany jest pod kluczem `mapaMagazynu` obok istniejącego `widok` w `history.state`.
 */
export type PolozenieMapy = { rodzicId: string | null; wybranaId: string | null }
export type WpisNawigacjiMapy = PolozenieMapy & { indeks: number }

export const kluczStanuMapyMagazynu = 'mapaMagazynu'

function tekstLubNull(wartosc: unknown): string | null {
  return typeof wartosc === 'string' && wartosc ? wartosc : null
}

/** Odczytuje wpis nawigacji z `history.state`; zwraca null dla stanu spoza mapy lub uszkodzonego. */
export function odczytajWpisNawigacjiMapy(stanHistorii: unknown): WpisNawigacjiMapy | null {
  if (!stanHistorii || typeof stanHistorii !== 'object') return null
  const surowy = (stanHistorii as Record<string, unknown>)[kluczStanuMapyMagazynu]
  if (!surowy || typeof surowy !== 'object') return null
  const { rodzicId, wybranaId, indeks } = surowy as Record<string, unknown>
  if (typeof indeks !== 'number' || !Number.isInteger(indeks) || indeks < 0) return null
  return { rodzicId: tekstLubNull(rodzicId), wybranaId: tekstLubNull(wybranaId), indeks }
}

/** Zwraca nowy stan historii z zachowaniem pozostałych pól (np. `widok`). */
export function zbudujStanHistoriiMapy(stanHistorii: unknown, wpis: WpisNawigacjiMapy): Record<string, unknown> {
  const baza = stanHistorii && typeof stanHistorii === 'object' ? stanHistorii as Record<string, unknown> : {}
  return { ...baza, [kluczStanuMapyMagazynu]: wpis }
}

/** Odrzuca identyfikatory lokalizacji, które już nie istnieją (np. po wczytaniu innego planu). */
export function zweryfikujPolozenieMapy(polozenie: PolozenieMapy, istniejaceId: ReadonlySet<string>): PolozenieMapy {
  const rodzicId = polozenie.rodzicId && istniejaceId.has(polozenie.rodzicId) ? polozenie.rodzicId : null
  const wybranaId = polozenie.wybranaId && istniejaceId.has(polozenie.wybranaId) ? polozenie.wybranaId : null
  return { rodzicId, wybranaId }
}

/** Zmiana poziomu planu (wejście do wnętrza, powrót) tworzy wpis historii; samo zaznaczenie go nie tworzy. */
export function czyZmianaPoziomuPlanu(poprzednie: PolozenieMapy, nastepne: PolozenieMapy): boolean {
  return poprzednie.rodzicId !== nastepne.rodzicId
}
