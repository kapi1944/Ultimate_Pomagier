import { czyTrybDemonstracyjny } from './uwierzytelnianie'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { odswiezPotwierdzonaSesje, wyczyscPotwierdzonaSesje, zakonczPotwierdzonaSesje } from './klientTozsamosci'
import { pobierzAktywnychUzytkownikowWedlugRoli, pobierzUzytkownika, subskrybujUzytkownikow } from '../../kartoteki/uzytkownicy/magazynUzytkownikow'
import { pobierzZalogowanegoUzytkownika, rozpocznijSesje, zakonczSesje } from './sesjaUzytkownika'
import { KontekstUzytkownika } from './stanKontekstuUzytkownika'
import { wrocDoLogowaniaDesktopowego } from './daneDesktop'
import { zachowajReferencjeJesliRowne } from './stabilnyStan'

export function DostawcaUzytkownika({ children }: { children: ReactNode }) {
  const [zalogowanyUzytkownik, ustawZalogowanegoUzytkownikaSurowo] = useState(() => czyTrybDemonstracyjny ? pobierzZalogowanegoUzytkownika() : null)
  const [aktywniUzytkownicy, ustawAktywnychUzytkownikow] = useState(() => pobierzAktywnychUzytkownikowWedlugRoli())
  // Odczyt z magazynu tworzy nowe obiekty przy każdym wywołaniu; zachowanie referencji przy równej zawartości
  // zapobiega ponownemu renderowaniu wszystkich konsumentów kontekstu (cykliczne odświeżanie sesji, zdarzenia magazynu).
  const odswiezAktywnychUzytkownikow = useCallback(() => {
    const aktualni = pobierzAktywnychUzytkownikowWedlugRoli()
    ustawAktywnychUzytkownikow((poprzedni) => zachowajReferencjeJesliRowne(poprzedni, aktualni))
  }, [])
  const ustawZalogowanegoUzytkownika = useCallback((uzytkownik: ReturnType<typeof pobierzZalogowanegoUzytkownika>) => {
    ustawZalogowanegoUzytkownikaSurowo((poprzedni) => zachowajReferencjeJesliRowne(poprzedni, uzytkownik))
    odswiezAktywnychUzytkownikow()
  }, [odswiezAktywnychUzytkownikow])
  const [inicjalizacja, ustawInicjalizacje] = useState(() => ({ aktywna: !czyTrybDemonstracyjny, etap: 'Przygotowywanie aplikacji' }))
  const odswiezUzytkownika = useCallback(async (pokazEkranInicjalizacji = false) => {
    if (czyTrybDemonstracyjny) { ustawZalogowanegoUzytkownika(pobierzZalogowanegoUzytkownika()); return }
    const raportujEtap = (etap: string) => { if (pokazEkranInicjalizacji) ustawInicjalizacje({ aktywna: true, etap }) }
    try {
      const uzytkownik = await odswiezPotwierdzonaSesje(raportujEtap)
      if (pokazEkranInicjalizacji) ustawInicjalizacje({ aktywna: true, etap: 'Interfejs gotowy' })
      ustawZalogowanegoUzytkownika(uzytkownik)
    } catch (blad) { wyczyscPotwierdzonaSesje(); ustawZalogowanegoUzytkownika(null); await wrocDoLogowaniaDesktopowego(true); throw blad }
    finally { if (pokazEkranInicjalizacji) ustawInicjalizacje({ aktywna: false, etap: '' }) }
  }, [ustawZalogowanegoUzytkownika])
  useEffect(() => subskrybujUzytkownikow(odswiezAktywnychUzytkownikow), [odswiezAktywnychUzytkownikow])
  useEffect(() => {
    if (czyTrybDemonstracyjny) return
    let aktywny = true
    void odswiezPotwierdzonaSesje((etap) => { if (aktywny) ustawInicjalizacje({ aktywna: true, etap }) }).then((konto) => { if (aktywny) { ustawInicjalizacje({ aktywna: true, etap: 'Interfejs gotowy' }); ustawZalogowanegoUzytkownika(konto) } }).catch(() => { if (aktywny) { wyczyscPotwierdzonaSesje(); ustawZalogowanegoUzytkownika(null); void wrocDoLogowaniaDesktopowego(true) } }).finally(() => { if (aktywny) ustawInicjalizacje({ aktywna: false, etap: '' }) })
    const licznik = window.setInterval(() => { void odswiezUzytkownika() }, 15000)
    const odswiez = () => { void odswiezUzytkownika() }
    window.addEventListener('focus', odswiez)
    return () => { aktywny = false; window.clearInterval(licznik); window.removeEventListener('focus', odswiez) }
  }, [odswiezUzytkownika, ustawZalogowanegoUzytkownika])
  const zaloguj = useCallback((uzytkownikId: string) => {
    if (!czyTrybDemonstracyjny || uzytkownikId !== 'administrator-kacper-madej') return false
    const czyRozpoczeto = rozpocznijSesje(uzytkownikId)
    ustawZalogowanegoUzytkownika(czyRozpoczeto ? pobierzUzytkownika(uzytkownikId) ?? null : null)
    return czyRozpoczeto
  }, [ustawZalogowanegoUzytkownika])
  const wyloguj = useCallback(() => {
    if (czyTrybDemonstracyjny) { zakonczSesje(); ustawZalogowanegoUzytkownika(null); return }
    return zakonczPotwierdzonaSesje().then(() => ustawZalogowanegoUzytkownika(null)).catch(() => window.alert('Nie udało się unieważnić sesji. Spróbuj wylogować się ponownie.'))
  }, [ustawZalogowanegoUzytkownika])
  const wartosc = useMemo(() => ({ zalogowanyUzytkownik, inicjalizacja, aktywniUzytkownicy, zaloguj, wyloguj, odswiezUzytkownika }), [zalogowanyUzytkownik, inicjalizacja, aktywniUzytkownicy, zaloguj, wyloguj, odswiezUzytkownika])
  return <KontekstUzytkownika.Provider value={wartosc}>{children}</KontekstUzytkownika.Provider>
}
