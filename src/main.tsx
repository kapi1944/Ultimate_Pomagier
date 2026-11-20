import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { przygotujDaneDesktop } from './aplikacja/logowanie/daneDesktop'
import './wspolne/komponenty/tokeny.css'
import { pobierzUstawieniaAplikacji, zastosujUstawieniaAplikacji } from './aplikacja/ustawienia/magazynUstawienAplikacji'
import { zastosujSkaleInterfejsu, zarejestrujSkrotySkaliInterfejsu } from './aplikacja/ustawienia/skalaInterfejsu'

// Kartoteka miejscowości jest duża, więc jej przygotowanie odkładamy do czasu bezczynności po pierwszym renderze.
function zaplanujRozgrzewkeKartotekiLokalizacji() {
  const rozgrzej = () => {
    import('./kartoteki/lokalizacje/magazynLokalizacji')
      .then(({ rozgrzejKartotekeLokalizacji }) => rozgrzejKartotekeLokalizacji())
      .catch((blad: unknown) => { console.warn('Nie udało się wstępnie przygotować kartoteki lokalizacji.', blad) })
  }
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(rozgrzej, { timeout: 3000 })
  else window.setTimeout(rozgrzej, 1500)
}

async function uruchomAplikacje() {
  await przygotujDaneDesktop()
  const { default: App } = await import('./App.tsx')
  const ustawienia = pobierzUstawieniaAplikacji()
  zastosujUstawieniaAplikacji(ustawienia)
  await zastosujSkaleInterfejsu(ustawienia.wyglad.skalaInterfejsu)
  const usunSkroty = zarejestrujSkrotySkaliInterfejsu()
  import.meta.hot?.dispose(usunSkroty)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  zaplanujRozgrzewkeKartotekiLokalizacji()
}

void uruchomAplikacje().catch((blad: unknown) => {
  const korzen = document.getElementById('root')
  if (korzen) { korzen.setAttribute('role', 'alert'); korzen.textContent = `Nie udało się bezpiecznie uruchomić danych konta. ${blad instanceof Error ? blad.message : 'Zamknij aplikację i spróbuj ponownie.'}` }
})
