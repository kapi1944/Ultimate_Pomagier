import { lazy } from 'react'

// Widoki aplikacji są ładowane leniwie, aby pierwsze uruchomienie nie pobierało i nie wykonywało kodu wszystkich generatorów.
// Pulpit (widok startowy) pozostaje importowany statycznie w UkladAplikacji.
const wczytywaczeWidokow = {
  WidokZakupow: () => import('../../moduly/zakupy/WidokZakupow'),
  WidokUstawien: () => import('../ustawienia/WidokUstawien'),
  WidokNarzedzi: () => import('../../moduly/narzedzia/WidokNarzedzi'),
  WidokPoprawiaczaPrezentacji: () => import('../../moduly/narzedzia/poprawiacz_prezentacji/WidokPoprawiaczaPrezentacji'),
  WidokKartotek: () => import('../../kartoteki/WidokKartotek'),
  WidokProfiluUzytkownika: () => import('../../kartoteki/uzytkownicy/WidokProfiluUzytkownika'),
  WidokUzytkownikow: () => import('../../kartoteki/uzytkownicy/WidokUzytkownikow'),
  WidokKopiiRoboczychDokumentow: () => import('../../moduly/dokumenty/WidokKopiiRoboczychDokumentow'),
  WidokWszystkichDokumentow: () => import('../../moduly/dokumenty/WidokWszystkichDokumentow'),
  WidokAnkiet: () => import('../../moduly/dokumenty/generatory/ankiety/WidokAnkiet'),
  WidokDyplomow: () => import('../../moduly/dokumenty/generatory/dyplomy/WidokDyplomow'),
  WidokKartNaDrzwi: () => import('../../moduly/dokumenty/generatory/karta_na_drzwi/WidokKartNaDrzwi'),
  WidokChecklistPaczek: () => import('../../moduly/dokumenty/generatory/checklisty_paczek/WidokChecklistPaczek'),
  WidokListyObecnosciZDokumentu: () => import('../../moduly/dokumenty/generatory/listy_obecnosci/WidokListyObecnosciZDokumentu'),
  WidokProgramowSzkolen: () => import('../../moduly/dokumenty/generatory/programy_szkolen/WidokProgramowSzkolen').then((modul) => ({ default: modul.WidokProgramowSzkolen })),
  WidokReplikatoraDokumentow: () => import('../../moduly/dokumenty/replikator_dokumentow/WidokReplikatoraDokumentow'),
  WidokSzkolenOtwartych: () => import('../../moduly/otwarte/WidokSzkolenOtwartych'),
  WidokKopiiRoboczychSzczegolowOrganizacyjnych: () => import('../../moduly/zamkniete/szczegoly_organizacyjne/widoki/WidokKopiiRoboczychSzczegolowOrganizacyjnych'),
  WidokListySzczegolowOrganizacyjnych: () => import('../../moduly/zamkniete/szczegoly_organizacyjne/widoki/WidokListySzczegolowOrganizacyjnych'),
  WidokNowychSzczegolowOrganizacyjnych: () => import('../../moduly/zamkniete/szczegoly_organizacyjne/widoki/WidokNowychSzczegolowOrganizacyjnych'),
  WidokGeneratoraSzczegolow: () => import('../../moduly/zamkniete/szkolenia/generator_szczegolow/WidokGeneratoraSzczegolow'),
  WidokSzkolenZamknietych: () => import('../../moduly/zamkniete/szkolenia/WidokSzkolenZamknietych'),
} as const

export const WidokZakupow = lazy(wczytywaczeWidokow.WidokZakupow)
export const WidokUstawien = lazy(wczytywaczeWidokow.WidokUstawien)
export const WidokNarzedzi = lazy(wczytywaczeWidokow.WidokNarzedzi)
export const WidokPoprawiaczaPrezentacji = lazy(wczytywaczeWidokow.WidokPoprawiaczaPrezentacji)
export const WidokKartotek = lazy(wczytywaczeWidokow.WidokKartotek)
export const WidokProfiluUzytkownika = lazy(wczytywaczeWidokow.WidokProfiluUzytkownika)
export const WidokUzytkownikow = lazy(wczytywaczeWidokow.WidokUzytkownikow)
export const WidokKopiiRoboczychDokumentow = lazy(wczytywaczeWidokow.WidokKopiiRoboczychDokumentow)
export const WidokWszystkichDokumentow = lazy(wczytywaczeWidokow.WidokWszystkichDokumentow)
export const WidokAnkiet = lazy(wczytywaczeWidokow.WidokAnkiet)
export const WidokDyplomow = lazy(wczytywaczeWidokow.WidokDyplomow)
export const WidokKartNaDrzwi = lazy(wczytywaczeWidokow.WidokKartNaDrzwi)
export const WidokChecklistPaczek = lazy(wczytywaczeWidokow.WidokChecklistPaczek)
export const WidokListyObecnosciZDokumentu = lazy(wczytywaczeWidokow.WidokListyObecnosciZDokumentu)
export const WidokProgramowSzkolen = lazy(wczytywaczeWidokow.WidokProgramowSzkolen)
export const WidokReplikatoraDokumentow = lazy(wczytywaczeWidokow.WidokReplikatoraDokumentow)
export const WidokSzkolenOtwartych = lazy(wczytywaczeWidokow.WidokSzkolenOtwartych)
export const WidokKopiiRoboczychSzczegolowOrganizacyjnych = lazy(wczytywaczeWidokow.WidokKopiiRoboczychSzczegolowOrganizacyjnych)
export const WidokListySzczegolowOrganizacyjnych = lazy(wczytywaczeWidokow.WidokListySzczegolowOrganizacyjnych)
export const WidokNowychSzczegolowOrganizacyjnych = lazy(wczytywaczeWidokow.WidokNowychSzczegolowOrganizacyjnych)
export const WidokGeneratoraSzczegolow = lazy(wczytywaczeWidokow.WidokGeneratoraSzczegolow)
export const WidokSzkolenZamknietych = lazy(wczytywaczeWidokow.WidokSzkolenZamknietych)

/**
 * Pobiera kod widoków w tle, po jednym w czasie bezczynności przeglądarki, żeby późniejsza nawigacja
 * nie czekała na sieć. Wywołanie jest bezpieczne wielokrotnie; błąd pojedynczego widoku nie przerywa pozostałych
 * (widok zostanie wtedy pobrany przy pierwszym otwarciu).
 */
export function wczytajWidokiWTle() {
  const kolejka = Object.entries(wczytywaczeWidokow)
  let anulowano = false
  let uchwyt: number | undefined

  function zaplanuj(funkcja: () => void) {
    if (typeof window.requestIdleCallback === 'function') uchwyt = window.requestIdleCallback(funkcja, { timeout: 5000 })
    else uchwyt = window.setTimeout(funkcja, 500)
  }

  function wczytajNastepny() {
    if (anulowano) return
    const pozycja = kolejka.shift()
    if (!pozycja) return
    pozycja[1]().catch((blad: unknown) => { console.warn(`Nie udało się wstępnie pobrać widoku ${pozycja[0]}.`, blad) }).finally(() => zaplanuj(wczytajNastepny))
  }

  zaplanuj(wczytajNastepny)

  return () => {
    anulowano = true
    if (uchwyt === undefined) return
    if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(uchwyt)
    window.clearTimeout(uchwyt)
  }
}
