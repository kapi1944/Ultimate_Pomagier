import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Dokument } from '../../../../wspolne/dokumenty/modelDokumentu'
import type { KonfiguracjaPakietu } from '../../../../wspolne/dokumenty/pakietyDoZatwierdzenia/modelPakietu'

// Miniatura korzysta z tych samych adapterów renderowania co pakiet PDF, więc pokazuje pierwszą stronę z zapisanego stanu dokumentu.
const konfiguracjaMiniatury: KonfiguracjaPakietu = {
  wersjaSchematu: 1,
  kolejnosc: [],
  wybraneId: [],
  grupyId: null,
  stronaTytulowa: false,
  spisDokumentow: false,
  podzialNaGrupy: false,
  oznaczenie: false,
  trybCertyfikatow: 'wzor',
}

type StanMiniatury = 'oczekuje' | 'ladowanie' | 'gotowa' | 'blad'

type WlasciwosciMiniaturyDokumentu = {
  dokument: Dokument<unknown, unknown> | null
  etykieta: string
}

export default function MiniaturaDokumentu({ dokument, etykieta }: WlasciwosciMiniaturyDokumentu) {
  const ramkaRef = useRef<HTMLDivElement>(null)
  const tresc = useRef<HTMLDivElement>(null)
  const [czyWidoczna, ustawCzyWidoczna] = useState(typeof IntersectionObserver === 'undefined')
  const [stan, ustawStan] = useState<StanMiniatury>('oczekuje')
  const klucz = dokument ? `${dokument.id}:${dokument.zaktualizowano}` : null

  useEffect(() => {
    const ramka = ramkaRef.current
    if (!ramka || !klucz) return undefined
    const obserwator = new IntersectionObserver((wpisy) => {
      if (wpisy.some((wpis) => wpis.isIntersecting)) {
        ustawCzyWidoczna(true)
        obserwator.disconnect()
      }
    }, { rootMargin: '200px' })
    obserwator.observe(ramka)
    return () => obserwator.disconnect()
  }, [klucz])

  useEffect(() => {
    const kontener = tresc.current
    if (!dokument || !kontener || !czyWidoczna) return undefined
    let anulowano = false
    let korzen: ReturnType<typeof createRoot> | null = null
    ustawStan('ladowanie')
    import('../../../../wspolne/dokumenty/pakietyDoZatwierdzenia/renderujDokumentPakietu')
      .then(({ przygotujRenderer }) => przygotujRenderer(dokument, konfiguracjaMiniatury))
      .then((renderer) => {
        if (anulowano) return
        korzen = createRoot(kontener, { onUncaughtError: () => { if (!anulowano) ustawStan('blad') } })
        korzen.render(renderer.zawartosc)
        ustawStan('gotowa')
      })
      .catch(() => { if (!anulowano) ustawStan('blad') })
    return () => {
      anulowano = true
      // Odmontowanie poza cyklem renderowania Reacta, aby uniknąć ostrzeżenia o synchronicznym unmount.
      const doOdmontowania = korzen
      if (doOdmontowania) queueMicrotask(() => doOdmontowania.unmount())
    }
  }, [dokument, klucz, czyWidoczna])

  const widocznaTresc = Boolean(dokument) && stan !== 'blad'
  return (
    <div
      className={`szczegoly-miniatura${dokument ? '' : ' szczegoly-miniatura--pusta'}`}
      data-stan={dokument ? stan : 'brak'}
      ref={ramkaRef}
      role="img"
      aria-label={dokument ? `Miniatura pierwszej strony: ${etykieta}` : `Brak dokumentu: ${etykieta}`}
    >
      {widocznaTresc && <div aria-hidden="true" className="szczegoly-miniatura__tresc" key={klucz} ref={tresc} />}
      {(!dokument || stan === 'blad') && <span className="szczegoly-miniatura__brak">{dokument ? 'Brak podglądu' : 'Brak'}</span>}
    </div>
  )
}
