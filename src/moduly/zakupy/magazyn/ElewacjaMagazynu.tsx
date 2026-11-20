import { useState } from 'react'
import type { LokalizacjaMapy, StanWLokalizacji } from '../modele/zakupy'
import { policzPozycjeNaPolce, zbudujElewacje, znajdzStrefyElewacji } from '../logika/elewacjaMagazynu'

const krokPowiekszenia = 0.2

export default function ElewacjaMagazynu({ lokalizacje, stany, wybranaId, podswietloneId, czyFiltr, wybierz }: {
  lokalizacje: LokalizacjaMapy[]
  stany: StanWLokalizacji[]
  wybranaId: string | null
  podswietloneId: Set<string>
  czyFiltr: boolean
  wybierz: (id: string) => void
}) {
  const strefy = znajdzStrefyElewacji(lokalizacje)
  const [wybranaStrefaId, ustawStrefe] = useState('')
  const [powiekszenie, ustawPowiekszenie] = useState(1)
  const strefa = strefy.find((obecna) => obecna.id === wybranaStrefaId) ?? strefy[0]
  const meble = strefa ? zbudujElewacje(lokalizacje, strefa.id) : []

  if (!strefa) return <p className="mapa-magazynu__pusty">Brak mebli z widokiem elewacji. W trybie edycji możesz utworzyć układ lewej ściany.</p>

  return <>
    <div className="zakupy__nawigacja" role="group" aria-label="Narzędzia elewacji">
      {strefy.length > 1 && <label>Ściana<select value={strefa.id} onChange={(zdarzenie) => ustawStrefe(zdarzenie.target.value)}>{strefy.map((obecna) => <option key={obecna.id} value={obecna.id}>{obecna.pelnyKod} — {obecna.nazwa}</option>)}</select></label>}
      <button type="button" aria-label="Pomniejsz elewację" disabled={powiekszenie <= 0.6} onClick={() => ustawPowiekszenie((obecne) => Math.max(0.6, Math.round((obecne - krokPowiekszenia) * 10) / 10))}>−</button>
      <output aria-label="Powiększenie elewacji">{Math.round(powiekszenie * 100)}%</output>
      <button type="button" aria-label="Powiększ elewację" disabled={powiekszenie >= 1.6} onClick={() => ustawPowiekszenie((obecne) => Math.min(1.6, Math.round((obecne + krokPowiekszenia) * 10) / 10))}>+</button>
    </div>
    <div className="mapa-magazynu__przewijanie" tabIndex={0} role="region" aria-label={`Przewijana elewacja: ${strefa.pelnyKod} — ${strefa.nazwa}`}>
      <div className="elewacja__sciana" style={{ width: `${powiekszenie * 100}%`, minWidth: 560 * powiekszenie, height: 460 * powiekszenie }}>
        {meble.map((mebel) => {
          const czyTrafienie = czyFiltr && podswietloneId.has(mebel.id)
          return <div key={mebel.id}
            className={`elewacja__mebel${mebel.rodzaj === 'SZAFA' ? ' elewacja__mebel--szafa' : ''}${!mebel.czyAktywny ? ' elewacja__mebel--nieaktywny' : ''}${czyFiltr && !czyTrafienie ? ' elewacja__mebel--przygaszony' : ''}`}
            style={{ left: `${mebel.x}%`, width: `${mebel.szerokosc}%` }}>
            <button type="button" className="elewacja__naglowek" aria-pressed={wybranaId === mebel.id} aria-label={`${mebel.rodzaj === 'SZAFA' ? 'Szafa' : 'Regał'} ${mebel.pelnyKod} — ${mebel.nazwa}`} title={`${mebel.pelnyKod} — ${mebel.nazwa}`} onClick={() => wybierz(mebel.id)}>{mebel.kod}</button>
            <div className="elewacja__sekcje">
              {mebel.sekcje.map((sekcja) => <div key={sekcja.numer} className="elewacja__sekcja">
                {[...sekcja.polki].reverse().map((polka) => {
                  const liczba = policzPozycjeNaPolce(stany, polka.id)
                  const opis = `${polka.pelnyKod} — ${polka.nazwa}${polka.czyAktywna ? '' : ' (nieaktywna)'}. ${liczba ? `Pozycji: ${liczba}.` : 'Pusta.'}`
                  return <button key={polka.id} type="button" aria-pressed={wybranaId === polka.id} aria-label={opis} title={opis}
                    className={`elewacja__polka${!polka.czyAktywna ? ' elewacja__polka--nieaktywna' : ''}${czyFiltr && podswietloneId.has(polka.id) ? ' elewacja__polka--trafienie' : ''}${czyFiltr && !podswietloneId.has(polka.id) ? ' elewacja__polka--przygaszona' : ''}`}
                    onClick={() => wybierz(polka.id)}>
                    <span>{polka.kod}</span>{liczba > 0 && <small aria-hidden="true">{liczba}</small>}
                  </button>
                })}
              </div>)}
            </div>
            {mebel.rodzaj === 'SZAFA' && <span className="elewacja__drzwi" aria-hidden="true" />}
          </div>
        })}
      </div>
    </div>
    <p>Półki numerowane od dołu (PL-01 = najniższa). Układ poziomy pochodzi z pozycji mebli na planie strefy.</p>
  </>
}
