import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { drukujDokument, utworzNazwePlikuPdf, zapiszWyrenderowanyPdf } from '../../../../wspolne/dokumenty/eksportPdf'
import { oznaczSemantykePdf, zmierzScenePdf } from '../../../../wspolne/dokumenty/semantykaPdf'
import { zakodujAdresEtykiety } from './kodQrEtykiety'
import { celeEtykiety, czyWymiaryEtykietyPoprawne, pobierzEtykietyPaczek, type CelEtykiety, type EtykietaPaczki, type TrybEtykiety, type WymiaryEtykiety } from './modelEtykietyPaczki'
import type { DaneChecklistyPaczki } from './modelChecklistyPaczki'
import PodgladWydrukuPaczki from './PodgladWydrukuPaczki'
import { PanelGeneratoraDokumentu, UkladFormularzaIPodgladu } from '../../wspolne/UkladGeneratoraDokumentu'
import { pobierzZrodloEtykiety, zarejestrujEksportEtykiet, type DokumentChecklistyPaczki } from './rejestrChecklistPaczek'
import { dopasujEtykiete } from './dopasowanieEtykietyPaczki'
import { komunikatPrzepelnieniaEtykiety, nazwyPolEtykiety, normalizujUstawieniaEtykiety, utworzUstawieniaEtykiety, type PoleEtykiety, type UstawieniaEtykiety } from './ustawieniaEtykietyPaczki'
import { pobierzSzablonyEtykietPaczek, zapiszNowySzablonChecklisty } from './szablonyChecklistPaczek'
import './panelEtykietPaczek.css'

const listaCelow = Object.entries(celeEtykiety) as [CelEtykiety, string][]

function KodQr({ adres }: { adres: string }) {
  const matryca = zakodujAdresEtykiety(adres)
  const krok = 100 / (matryca.length + 8)
  const paski = matryca.flatMap((wiersz, y) => wiersz.flatMap((ciemny, x) => {
    if (!ciemny || wiersz[x - 1]) return []
    const dlugosc = wiersz.slice(x).findIndex((pole) => !pole)
    return [<span key={`${x}-${y}`} style={{ left: `${(x + 4) * krok}%`, top: `${(y + 4) * krok}%`,
      width: `${(dlugosc === -1 ? wiersz.length - x : dlugosc) * krok}%`, height: `${krok}%` }} />]
  }))
  return <div className="etykieta-paczki__qr" aria-hidden="true">{paski}</div>
}

function Etykieta({ etykieta, wymiary, tryb, logo, czyQr }: {
  etykieta: EtykietaPaczki; wymiary: WymiaryEtykiety; tryb: TrybEtykiety; logo: string; czyQr: boolean
}) {
  const { pola, rodzaj } = etykieta.ustawienia
  const szkoleniowa = rodzaj === 'szkoleniowa'
  const pozycje = etykieta.pozycje.filter((pozycja) => !pozycja.czyUkryta)
  return <article data-strona-dokumentu data-etykieta={etykieta.paczkaId} data-tryb={tryb} data-zageszczenie="standard" className="etykieta-paczki"
    aria-label={'Etykieta: ' + etykieta.nazwaPaczki} style={{ width: wymiary.szerokosc + 'mm', height: wymiary.wysokosc + 'mm' }}>
    <header className="etykieta-paczki__naglowek">
      <div>{pola.logo && logo && <img src={logo} alt={etykieta.organizator} />}
        {szkoleniowa && pola.kod && etykieta.kod && <div className="etykieta-paczki__kod">{etykieta.kod}</div>}
        {!szkoleniowa && <strong>ZAWARTOŚĆ PACZKI</strong>}</div>
      {pola.numer && <div><b>{etykieta.nazwaPaczki}</b><strong className="etykieta-paczki__numer">{etykieta.numer + ' / ' + etykieta.razem}</strong></div>}
    </header>
    <div className="etykieta-paczki__tresc">
      {szkoleniowa && <>
        {pola.tytul && etykieta.tytul && <h3>{etykieta.tytul}</h3>}
        {pola.grupa && etykieta.grupa && <p>{etykieta.grupa}</p>}
        {pola.uczestnicy && <p>{'Uczestnicy: ' + etykieta.uczestnicy}</p>}
        {pola.termin && etykieta.termin && <p>{etykieta.termin}</p>}
        {pola.miejsce && etykieta.miejsce && <p>{etykieta.miejsce}</p>}
        {pola.trenerzy && etykieta.trenerzy.length > 0 && <p>{etykieta.trenerzy.join(', ')}</p>}
      </>}
      <table className="etykieta-paczki__zawartosc" aria-label="Zawartość paczki do odhaczenia">
        <colgroup><col className="etykieta-paczki__kolumna-kontroli" /><col /><col className="etykieta-paczki__kolumna-ilosci" /></colgroup>
        <thead><tr><th scope="col">OK</th><th scope="col">ZAWARTOŚĆ</th><th scope="col">ILOŚĆ</th></tr></thead>
        <tbody>{pozycje.map((pozycja) => <tr key={pozycja.id} className="etykieta-paczki__pozycja">
          <td><span className="etykieta-paczki__checkbox" aria-label="Pole do ręcznego odhaczenia" /></td>
          <td>{pozycja.nazwa}{szkoleniowa && pola.uwagi && pozycja.uwagi && <small>{pozycja.uwagi}</small>}</td>
          <td>{pozycja.ilosc ?? ''}</td>
        </tr>)}</tbody>
      </table>
      {szkoleniowa && pola.uwagi && etykieta.uwagi && <p className="etykieta-paczki__uwagi">{etykieta.uwagi}</p>}
    </div>
    {czyQr && <footer className="etykieta-paczki__stopka">
      <div className="etykieta-paczki__kody">{listaCelow.map(([cel, nazwa]) => <div key={cel}>
        <KodQr adres={new URL(etykieta.adresy[cel], window.location.origin).href} /><b>{nazwa.toLocaleUpperCase('pl')}</b>
      </div>)}</div>
    </footer>}
  </article>
}

async function przygotujLogoTermiczne(adres: string) {
  const obraz = new Image()
  obraz.src = adres
  await obraz.decode()
  const kanwa = document.createElement('canvas')
  kanwa.width = obraz.naturalWidth
  kanwa.height = obraz.naturalHeight
  const kontekst = kanwa.getContext('2d')
  if (!kontekst) throw new Error('Nie udało się przygotować logo termicznego.')
  kontekst.fillStyle = '#fff'
  kontekst.fillRect(0, 0, kanwa.width, kanwa.height)
  kontekst.drawImage(obraz, 0, 0)
  const piksele = kontekst.getImageData(0, 0, kanwa.width, kanwa.height)
  for (let indeks = 0; indeks < piksele.data.length; indeks += 4) {
    const jasnosc = piksele.data[indeks] * 0.299 + piksele.data[indeks + 1] * 0.587 + piksele.data[indeks + 2] * 0.114
    piksele.data[indeks] = piksele.data[indeks + 1] = piksele.data[indeks + 2] = jasnosc < 210 ? 0 : 255
  }
  kontekst.putImageData(piksele, 0, 0)
  return kanwa.toDataURL('image/png')
}

export default function PanelEtykietPaczek({ dokument, moznaZapisywac, zapisz, odswiez }: {
  dokument: DokumentChecklistyPaczki
  moznaZapisywac: boolean
  zapisz: (dane: DaneChecklistyPaczki, opis: string) => boolean
  odswiez: () => void
}) {
  const etykiety = useMemo(() => {
    const zrodlo = pobierzZrodloEtykiety(dokument.daneDokumentu)
    return pobierzEtykietyPaczek(dokument, zrodlo)
  }, [dokument])
  const [paczkaId, ustawPaczke] = useState(etykiety[0].paczkaId)
  const ustawienia = useMemo(() => normalizujUstawieniaEtykiety(dokument.daneDokumentu.ustawieniaEtykiety), [dokument.daneDokumentu.ustawieniaEtykiety])
  const tryb = ustawienia.tryb
  const [format, ustawFormat] = useState(() => ustawienia.wymiary.szerokosc === 100 && [100, 150].includes(ustawienia.wymiary.wysokosc) ? String(ustawienia.wymiary.wysokosc) : 'wlasny')
  const [wlasne, ustawWlasne] = useState(ustawienia.wymiary)
  const [szablony, ustawSzablony] = useState(pobierzSzablonyEtykietPaczek)
  const [nazwaSzablonu, ustawNazweSzablonu] = useState('')
  const [czyProbaQr, ustawProbeQr] = useState(false)
  const [termiczneLogo, ustawTermiczneLogo] = useState({ adres: '', dane: '', blad: '' })
  const [przepelnione, ustawPrzepelnione] = useState<string[]>([])
  const [blad, ustawBlad] = useState('')
  const [czyEksport, ustawEksport] = useState(false)
  const idPol = useId()
  const obszar = useRef<HTMLDivElement>(null)
  const blokada = useRef(false)
  const etykieta = etykiety.find((obecna) => obecna.paczkaId === paczkaId) ?? etykiety[0]
  const wymiary = useMemo(() => format === 'wlasny' ? wlasne : { szerokosc: 100, wysokosc: Number(format) }, [format, wlasne])
  const czyPoprawnyFormat = czyWymiaryEtykietyPoprawne(wymiary)
  const moznaTestowacQr = import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  const logo = tryb === 'kolorowy' ? etykieta.logo : termiczneLogo.adres === etykieta.logo ? termiczneLogo.dane : ''
  const korekta = dokument.daneDokumentu.korektyEtykiet?.[etykieta.paczkaId]
  const ostatniEksport = etykieta.wydruki.findLast((wpis) => !wpis.wydrukEtykiety?.czyPotwierdzony)?.wydrukEtykiety
  useEffect(() => {
    if (!etykieta.logo || tryb !== 'termiczny') return
    let aktywne = true
    const adres = etykieta.logo
    void przygotujLogoTermiczne(adres).then((dane) => {
      if (aktywne) ustawTermiczneLogo({ adres, dane, blad: '' })
    }).catch(() => { if (aktywne) ustawTermiczneLogo({ adres, dane: '', blad: 'Nie udało się przygotować logo termicznego.' }) })
    return () => { aktywne = false }
  }, [etykieta.logo, tryb])
  const stronaQr = useCallback((obecna: EtykietaPaczki) => obecna.ustawienia.rodzaj === 'szkoleniowa' && moznaTestowacQr && czyProbaQr && obecna.czyPowiazana
    && Object.values(obecna.adresy).every((adres) => new TextEncoder().encode(new URL(adres, window.location.origin).href).length <= 134), [czyProbaQr, moznaTestowacQr])
  // Scena i podgląd korzystają z tego samego drzewa oraz tych samych wymiarów.
  const podglad = useMemo(() => czyPoprawnyFormat && etykiety.map((obecna) => <div key={obecna.paczkaId} data-wybrana={obecna.paczkaId === etykieta.paczkaId} aria-hidden={obecna.paczkaId !== etykieta.paczkaId}>
    {oznaczSemantykePdf(<Etykieta etykieta={obecna} wymiary={wymiary} tryb={tryb} logo={logo} czyQr={stronaQr(obecna)} />)}
  </div>), [czyPoprawnyFormat, etykiety, etykieta.paczkaId, wymiary, tryb, logo, stronaQr])
  useLayoutEffect(() => {
    const strony = Array.from(obszar.current?.querySelectorAll<HTMLElement>('[data-etykieta]') ?? [])
    let aktywne = true
    const dopasuj = () => {
      if (!aktywne) return
      const wynik = strony.filter((strona) => !dopasujEtykiete(strona, ustawienia.dopasowanie)).map((strona) => strona.dataset.etykieta!)
      ustawPrzepelnione((obecne) => JSON.stringify(obecne) === JSON.stringify(wynik) ? obecne : wynik)
    }
    dopasuj()
    void document.fonts.ready.then(dopasuj)
    strony.flatMap((strona) => Array.from(strona.querySelectorAll('img'))).forEach((obraz) => { void obraz.decode().then(dopasuj).catch(dopasuj) })
    return () => { aktywne = false }
  }, [podglad, ustawienia.dopasowanie])

  function zapiszUstawienia(zmiana: Partial<UstawieniaEtykiety>) {
    return zapisz({ ...dokument.daneDokumentu, ustawieniaEtykiety: { ...ustawienia, ...zmiana } }, 'Zapisano konfigurację wydruku etykiet.')
  }

  function zmienPozycjeUniwersalna(id: string, zmiana: Partial<UstawieniaEtykiety['pozycjeUniwersalne'][number]>) {
    zapiszUstawienia({ pozycjeUniwersalne: ustawienia.pozycjeUniwersalne.map((pozycja) => pozycja.id === id ? { ...pozycja, ...zmiana } : pozycja) })
  }

  function zastosujSzablon(identyfikator: string) {
    const wlasny = szablony.find((szablon) => szablon.id === identyfikator)
    const nowe = wlasny ? structuredClone(wlasny.ustawieniaEtykiety) : utworzUstawieniaEtykiety(identyfikator === 'uniwersalny' ? 'uniwersalna' : 'szkoleniowa')
    if (identyfikator === 'kompaktowy') nowe.pola.tytul = false
    zapiszUstawienia({ ...nowe, szablon: identyfikator })
    ustawFormat(nowe.wymiary.szerokosc === 100 && [100, 150].includes(nowe.wymiary.wysokosc) ? String(nowe.wymiary.wysokosc) : 'wlasny')
    ustawWlasne(nowe.wymiary)
  }

  function zapiszKorekte(zmiana: NonNullable<typeof korekta>) {
    zapisz({ ...dokument.daneDokumentu, korektyEtykiet: { ...dokument.daneDokumentu.korektyEtykiet,
      [etykieta.paczkaId]: { ...korekta, ...zmiana } } }, 'Zapisano korektę etykiety paczki.')
  }

  async function eksportuj(wybrane: EtykietaPaczki[], czyDruk = false) {
    if (blokada.current || !moznaZapisywac || !czyPoprawnyFormat || (ustawienia.pola.logo && etykieta.logo && !logo)) return
    blokada.current = true
    ustawEksport(true)
    ustawBlad('')
    try {
      const strony = Array.from(obszar.current?.querySelectorAll<HTMLElement>('[data-etykieta]') ?? [])
        .filter((strona) => wybrane.some((obecna) => obecna.paczkaId === strona.dataset.etykieta))
      await document.fonts?.ready
      await Promise.all(strony.flatMap((strona) => Array.from(strona.querySelectorAll('img')).map((obraz) => obraz.decode())))
      if (strony.length !== wybrane.length || strony.some((strona) => !dopasujEtykiete(strona, ustawienia.dopasowanie))) throw new Error(komunikatPrzepelnieniaEtykiety)
      const scena = zmierzScenePdf(strony, wymiary.szerokosc)
      const { renderujScenePdf, wczytajFontyPdf, wczytajObrazyPdf } = await import('../../../../wspolne/dokumenty/rendererPdf')
      const [fonty, obrazy] = await Promise.all([wczytajFontyPdf(), wczytajObrazyPdf(scena)])
      const pdf = renderujScenePdf(scena, fonty, obrazy, [wymiary.szerokosc, wymiary.wysokosc])
      const czyWydrukQr = wybrane.some(stronaQr)
      const nazwa = utworzNazwePlikuPdf(`${czyWydrukQr ? 'TEST-QR-' : ''}Etykiety-${dokument.daneDokumentu.identyfikator}${wybrane.length === 1 ? '-paczka-' + wybrane[0].numer : ''}`)
      if (!zarejestrujEksportEtykiet(dokument.id, wybrane, `${wymiary.szerokosc} × ${wymiary.wysokosc} mm`, tryb, czyWydrukQr)) {
        throw new Error('Dane etykiety zmieniły się lub zapis jest niedostępny. Odśwież podgląd.')
      }
      if (czyDruk) {
        for (const strona of strony) {
          strona.style.setProperty('--szerokosc-druku', wymiary.szerokosc + 'mm')
          strona.style.setProperty('--wysokosc-druku', wymiary.wysokosc + 'mm')
          await drukujDokument(strona, 'pionowa', [wymiary.szerokosc, wymiary.wysokosc])
        }
        if (!czyWydrukQr && window.confirm('Czy etykiety zostały fizycznie wydrukowane?')) {
          if (!zarejestrujEksportEtykiet(dokument.id, wybrane, wymiary.szerokosc + ' × ' + wymiary.wysokosc + ' mm', tryb, false, true)) throw new Error('Nie udało się potwierdzić wydruku.')
        }
      } else await zapiszWyrenderowanyPdf(pdf, nazwa)
      odswiez()
    } catch (blad) { ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się przygotować PDF etykiety.') }
    finally { blokada.current = false; ustawEksport(false) }
  }

  const czyMoznaEksportowac = moznaZapisywac && !czyEksport && czyPoprawnyFormat && (!ustawienia.pola.logo || !etykieta.logo || Boolean(logo))
  return <section aria-label="Etykiety paczek">
    <UkladFormularzaIPodgladu className="checklista-paczki__obszar-pracy etykiety-paczek__obszar">
    <PanelGeneratoraDokumentu wariant="edycja">
    <fieldset className="etykiety-paczek__konfiguracja" disabled={czyEksport || !moznaZapisywac}>
      <legend>Format i druk</legend>
      <label><span id={idPol + '-rodzaj'}>Rodzaj etykiety</span><select aria-labelledby={idPol + '-rodzaj'} value={ustawienia.rodzaj} onChange={(zdarzenie) => zapiszUstawienia({ rodzaj: zdarzenie.target.value === 'uniwersalna' ? 'uniwersalna' : 'szkoleniowa' })}>
        <option value="szkoleniowa">Szkoleniowa</option><option value="uniwersalna">Uniwersalna</option>
      </select></label>
      <label><span id={idPol + '-szablon'}>Szablon wydruku</span><select aria-labelledby={idPol + '-szablon'} value={ustawienia.szablon} onChange={(zdarzenie) => zastosujSzablon(zdarzenie.target.value)}>
        <option value="standard">Standard szkoleniowy</option><option value="uniwersalny">Uniwersalny</option><option value="kompaktowy">Kompaktowy</option>
        {szablony.map((szablon) => <option key={szablon.id} value={szablon.id}>{szablon.nazwa}</option>)}
      </select></label>
      <label><span id={idPol + '-dopasowanie'}>Dopasowanie zawartości</span><select aria-labelledby={idPol + '-dopasowanie'} value={ustawienia.dopasowanie} onChange={(zdarzenie) => {
        const dopasowanie = zdarzenie.target.value
        if (dopasowanie === 'automatyczne' || dopasowanie === 'standard' || dopasowanie === 'kompakt' || dopasowanie === 'maksymalny') zapiszUstawienia({ dopasowanie })
      }}><option value="automatyczne">Automatyczne</option><option value="standard">Standard</option><option value="kompakt">Kompakt</option><option value="maksymalny">Maksymalny czytelny</option></select></label>
      <label><span id={idPol + '-paczka'}>Paczka</span><select aria-labelledby={idPol + '-paczka'} value={etykieta.paczkaId} onChange={(zdarzenie) => ustawPaczke(zdarzenie.target.value)}>
        {etykiety.map((obecna) => <option key={obecna.paczkaId} value={obecna.paczkaId}>{`${obecna.numer}/${obecna.razem} · ${obecna.nazwaPaczki}`}</option>)}
      </select></label>
      <label><span id={idPol + '-tryb'}>Tryb druku</span><select aria-labelledby={idPol + '-tryb'} value={tryb} onChange={(zdarzenie) => zapiszUstawienia({ tryb: zdarzenie.target.value === 'kolorowy' ? 'kolorowy' : 'termiczny' })}>
        <option value="termiczny">Termiczny B/W</option><option value="kolorowy">Kolorowy</option>
      </select></label>
      <label><span id={idPol + '-format'}>Format etykiety</span><select aria-labelledby={idPol + '-format'} value={format} onChange={(zdarzenie) => { const nowy = zdarzenie.target.value; ustawFormat(nowy); zapiszUstawienia({ wymiary: nowy === 'wlasny' ? wlasne : { szerokosc: 100, wysokosc: Number(nowy) } }) }}>
        <option value="150">100 × 150 mm</option><option value="100">100 × 100 mm</option><option value="wlasny">Własny format</option>
      </select></label>
      {format === 'wlasny' && <>
        <label>Szerokość (mm)<input type="number" min="88" max="220" value={wlasne.szerokosc || ''} onBlur={() => { if (czyPoprawnyFormat) zapiszUstawienia({ wymiary: wlasne }) }} onChange={(zdarzenie) => ustawWlasne({ ...wlasne, szerokosc: Number(zdarzenie.target.value) })} /></label>
        <label>Wysokość (mm)<input type="number" min="80" max="320" value={wlasne.wysokosc || ''} onBlur={() => { if (czyPoprawnyFormat) zapiszUstawienia({ wymiary: wlasne }) }} onChange={(zdarzenie) => ustawWlasne({ ...wlasne, wysokosc: Number(zdarzenie.target.value) })} /></label>
      </>}
      {moznaTestowacQr && ustawienia.rodzaj === 'szkoleniowa' && <label><input type="checkbox" checked={czyProbaQr} onChange={(zdarzenie) => ustawProbeQr(zdarzenie.target.checked)} />Dodaj testowe QR w lokalnej przeglądarce</label>}
      <p>Drukuj PDF w skali 100%. Margines etykiety to 4 mm. Bezpośredni druk termiczny wymaga potwierdzenia drukarki i sterownika.</p>
      {ustawienia.rodzaj === 'szkoleniowa' && (etykieta.czyPowiazana ? <nav className="etykieta-paczki__linki" aria-label="Cele etykiety">{listaCelow.map(([cel, nazwa]) =>
        <a key={cel} href={etykieta.adresy[cel]}>{nazwa}</a>)}</nav> : <p>Powiąż checklistę z istniejącym szkoleniem i grupą, aby udostępnić cele etykiety.</p>)}
    </fieldset>
    <details className="etykiety-paczek__opcje"><summary>Treść i własne szablony</summary>
      <fieldset disabled={!moznaZapisywac || czyEksport}><legend>Pokaż na etykiecie</legend>
        {(Object.entries(nazwyPolEtykiety) as [PoleEtykiety, string][]).filter(([pole]) => ustawienia.rodzaj === 'szkoleniowa' || pole === 'logo' || pole === 'numer').map(([pole, nazwa]) =>
          <label key={pole}><input type="checkbox" checked={ustawienia.pola[pole]} onChange={(zdarzenie) => zapiszUstawienia({ pola: { ...ustawienia.pola, [pole]: zdarzenie.target.checked } })} />{nazwa}</label>)}
        <label>Nazwa szablonu wydruku<input value={nazwaSzablonu} onChange={(zdarzenie) => ustawNazweSzablonu(zdarzenie.target.value)} /></label>
        <button type="button" disabled={!nazwaSzablonu.trim()} onClick={() => {
          try {
            const id = crypto.randomUUID()
            const wynik = zapiszNowySzablonChecklisty({ id, nazwa: nazwaSzablonu.trim(), utworzono: new Date().toISOString(), przeznaczenie: 'etykieta',
              ustawieniaEtykiety: { ...ustawienia, szablon: id }, paczki: [], kategorie: [], pozycje: [] })
            if (!wynik) throw new Error('Podaj niepowtarzającą się nazwę szablonu wydruku.')
            ustawSzablony(pobierzSzablonyEtykietPaczek())
            zapiszUstawienia({ szablon: id })
            ustawNazweSzablonu('')
            ustawBlad('')
          } catch (blad) { ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się zapisać szablonu wydruku.') }
        }}>Zapisz szablon wydruku</button>
      </fieldset>
    </details>
    {ustawienia.rodzaj === 'uniwersalna' && <fieldset className="etykiety-paczek__uniwersalne" disabled={!moznaZapisywac || czyEksport}>
      <legend>Materiały etykiety uniwersalnej</legend>
      <p>Pusta ilość pozostaje miejscem do ręcznego wpisania. Zmiany dotyczą wyłącznie wydruku.</p>
      <div className="etykiety-paczek__tabela"><table aria-label="Materiały etykiety uniwersalnej"><thead><tr><th scope="col">Materiał</th><th scope="col">Ilość</th><th scope="col">Akcje</th></tr></thead>
      <tbody>{ustawienia.pozycjeUniwersalne.map((pozycja, indeks) => <tr key={pozycja.id}>
        <td><input aria-label={`Nazwa materiału uniwersalnego: ${indeks + 1}`} defaultValue={pozycja.nazwa} onBlur={(zdarzenie) => {
          if (zdarzenie.target.value !== pozycja.nazwa) zmienPozycjeUniwersalna(pozycja.id, { nazwa: zdarzenie.target.value })
        }} /></td>
        <td><input aria-label={`Ilość materiału uniwersalnego: ${indeks + 1}`} type="number" min="0" step="1" defaultValue={pozycja.ilosc ?? ''} onBlur={(zdarzenie) => {
          const ilosc = zdarzenie.target.value === '' ? null : zdarzenie.target.valueAsNumber
          if ((ilosc === null || (Number.isSafeInteger(ilosc) && ilosc >= 0)) && ilosc !== pozycja.ilosc) zmienPozycjeUniwersalna(pozycja.id, { ilosc })
        }} /></td>
        <td><label><input type="checkbox" aria-label={`Pokaż materiał uniwersalny: ${indeks + 1}`} checked={!pozycja.czyUkryta} onChange={(zdarzenie) => zmienPozycjeUniwersalna(pozycja.id, { czyUkryta: !zdarzenie.target.checked })} />Drukuj</label>
          {([-1, 1] as const).map((kierunek) => <button key={kierunek} type="button" aria-label={`${kierunek === -1 ? 'W górę' : 'W dół'}: materiał uniwersalny ${indeks + 1}`}
            disabled={indeks + kierunek < 0 || indeks + kierunek >= ustawienia.pozycjeUniwersalne.length} onClick={() => {
              const pozycje = [...ustawienia.pozycjeUniwersalne]
              ;[pozycje[indeks], pozycje[indeks + kierunek]] = [pozycje[indeks + kierunek], pozycje[indeks]]
              zapiszUstawienia({ pozycjeUniwersalne: pozycje })
            }}>{kierunek === -1 ? '↑' : '↓'}</button>)}
        </td>
      </tr>)}</tbody></table></div>
      <button type="button" onClick={() => zapiszUstawienia({ pozycjeUniwersalne: [...ustawienia.pozycjeUniwersalne, { id: crypto.randomUUID(), nazwa: 'Własny materiał', ilosc: null, czyUkryta: false }] })}>Dodaj własny materiał</button>
      <button type="button" onClick={() => zapiszUstawienia({ pozycjeUniwersalne: [...ustawienia.pozycjeUniwersalne, { id: crypto.randomUUID(), nazwa: '', ilosc: null, czyUkryta: false }] })}>Dodaj pusty wiersz</button>
    </fieldset>}
    <div className="etykiety-paczek__eksport" role="group" aria-label="Eksport etykiet">
      <button type="button" disabled={!czyMoznaEksportowac || przepelnione.includes(etykieta.paczkaId)} onClick={() => void eksportuj([etykieta], true)}>Drukuj etykietę</button>
      <button type="button" disabled={!czyMoznaEksportowac || przepelnione.includes(etykieta.paczkaId)} onClick={() => void eksportuj([etykieta])}>Pobierz PDF etykiety</button>
      <button type="button" disabled={!czyMoznaEksportowac || przepelnione.length > 0} onClick={() => void eksportuj(etykiety)}>Pobierz PDF wszystkich etykiet</button>
    </div>
    {!czyPoprawnyFormat && <p role="alert">Ustaw szerokość 88–220 mm i wysokość 80–320 mm.</p>}
    {przepelnione.length > 0 && czyPoprawnyFormat && <p role="alert">{komunikatPrzepelnieniaEtykiety} Paczki: {etykiety.filter((obecna) => przepelnione.includes(obecna.paczkaId)).map((obecna) => obecna.nazwaPaczki).join(', ')}.</p>}
    {ustawienia.rodzaj === 'szkoleniowa' && czyProbaQr && etykieta.czyPowiazana && !stronaQr(etykieta) && <p role="alert">Adres przekracza pojemność kodu QR etykiety.</p>}
    {(blad || (tryb === 'termiczny' && termiczneLogo.blad)) && <p role="alert">{blad || termiczneLogo.blad}</p>}
    {ustawienia.rodzaj === 'szkoleniowa' && <details className="etykiety-paczek__korekta" key={etykieta.paczkaId} open>
      <summary>Korekta treści do wydruku</summary>
      <fieldset disabled={!moznaZapisywac || czyEksport}><legend>Zmiany tylko na etykiecie</legend>
        <label>Kod szkolenia<input defaultValue={etykieta.kod} onBlur={(zdarzenie) => {
          if (zdarzenie.target.value !== etykieta.kod) zapiszKorekte({ kod: zdarzenie.target.value.trim() })
        }} /></label>
        <label><span id={idPol + '-uwagi'}>Uwagi etykiety</span><textarea aria-labelledby={idPol + '-uwagi'} defaultValue={etykieta.uwagi} onBlur={(zdarzenie) => {
          if (zdarzenie.target.value !== etykieta.uwagi) zapiszKorekte({ uwagi: zdarzenie.target.value.trim() })
        }} /></label>
        <div className="etykiety-paczek__tabela"><table aria-label="Korekta materiałów na etykiecie">
        <thead><tr><th scope="col">Materiał</th><th scope="col">Ilość</th></tr></thead><tbody>
        {etykieta.pozycje.map((pozycja) => <tr key={pozycja.id}>
          <td><label><input type="checkbox" aria-label={`Pokaż na wydruku: ${pozycja.nazwa}`} checked={!pozycja.czyUkryta} onChange={(zdarzenie) => zapiszKorekte({ pozycje: { ...korekta?.pozycje, [pozycja.id]: { ...korekta?.pozycje?.[pozycja.id], czyUkryta: !zdarzenie.target.checked } } })} />Drukuj</label><input aria-label={`Nazwa materiału na etykiecie: ${pozycja.nazwa}`} defaultValue={pozycja.nazwa} onBlur={(zdarzenie) => {
            const nazwa = zdarzenie.target.value.trim()
            if (nazwa && nazwa !== pozycja.nazwa) zapiszKorekte({ pozycje: { ...korekta?.pozycje, [pozycja.id]: { ...korekta?.pozycje?.[pozycja.id], nazwa } } })
          }} /></td>
          <td><input aria-label={`Ilość na etykiecie: ${pozycja.nazwa}`} type="number" min="0" step="1" defaultValue={pozycja.ilosc ?? ''} onBlur={(zdarzenie) => {
            const ilosc = zdarzenie.target.valueAsNumber
            if (Number.isSafeInteger(ilosc) && ilosc >= 0 && ilosc !== pozycja.ilosc) zapiszKorekte({ pozycje: { ...korekta?.pozycje, [pozycja.id]: { ...korekta?.pozycje?.[pozycja.id], ilosc } } })
          }} /></td>
        </tr>)}
        </tbody></table></div>
        {korekta && <button type="button" onClick={() => {
          const pozostale = { ...dokument.daneDokumentu.korektyEtykiet }
          delete pozostale[etykieta.paczkaId]
          zapisz({ ...dokument.daneDokumentu, korektyEtykiet: pozostale }, 'Przywrócono treść etykiety z checklisty.')
        }}>Przywróć dane z checklisty</button>}
      </fieldset>
    </details>
    }
    {etykiety.some((obecna) => obecna.czyNieaktualna) &&
      <p role="alert">Nieaktualna etykieta: {etykiety.filter((obecna) => obecna.czyNieaktualna).map((obecna) => obecna.nazwaPaczki).join(', ')}. Wygeneruj nową wersję.</p>}
    <details><summary>Historia eksportów i wydruków wybranej etykiety ({etykieta.wydruki.length})</summary>
      {ostatniEksport?.odcisk === etykieta.odcisk && !ostatniEksport.czyProbaQr && <button type="button" disabled={!moznaZapisywac || czyEksport} onClick={() => {
        try {
          if (!zarejestrujEksportEtykiet(dokument.id, [etykieta], ostatniEksport.format, ostatniEksport.tryb, false, true)) throw new Error('Etykieta zmieniła się. Odśwież podgląd.')
          ustawBlad('')
          odswiez()
        } catch (blad) { ustawBlad(blad instanceof Error ? blad.message : 'Nie udało się potwierdzić wydruku etykiety.') }
      }}>Potwierdź fizyczny wydruk v{ostatniEksport.wersja}</button>}
      <ul>{etykieta.wydruki.map((wpis) => <li key={wpis.id}>{wpis.data} · {wpis.wydrukEtykiety?.czyPotwierdzony ? 'wydruk' : 'PDF'} · v{wpis.wydrukEtykiety?.wersja} · {wpis.wydrukEtykiety?.format} · {wpis.wydrukEtykiety?.tryb} · {wpis.wydrukEtykiety?.rodzaj ?? 'szkoleniowa'}{wpis.wydrukEtykiety?.czyProbaQr ? ' · test QR' : ''}</li>)}</ul>
    </details>
    </PanelGeneratoraDokumentu>
    <PanelGeneratoraDokumentu wariant="podglad">
      <PodgladWydrukuPaczki tytul="Podgląd etykiety" szerokoscMm={wymiary.szerokosc} wysokoscMm={wymiary.wysokosc}>
        <div ref={obszar} className="etykiety-paczek__podglad" aria-label="Podgląd etykiet w wymiarach wydruku">{podglad}</div>
      </PodgladWydrukuPaczki>
    </PanelGeneratoraDokumentu>
    </UkladFormularzaIPodgladu>
  </section>
}
