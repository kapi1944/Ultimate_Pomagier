import { useMemo, useRef, useState } from 'react'
import type { ModelPptx } from '../pptx/modelPptx'
import type { DaneOkladki } from '../operacje/mapowanieDanych'
import { przygotujOkladkeSemper, type OrientacjaOkladki } from '../operacje/okladkiSemper'
import { zapiszPptx, nazwaPoprawionejPrezentacji } from '../pptx/zapiszPptx'
import { domyslneUstawieniaDruku, przygotujPlanDruku, zaleceniaDruku } from './planDruku'
import type { UstawieniaDruku } from './planDruku'
import { otworzPdfPrezentacji, renderujPptxDoPdf, sprawdzPdfPrezentacji } from './renderowaniePdf'
import { pobierzPlikMaterialow, wygenerujKompletZip, wygenerujPdfDruku, wygenerujPngOkladki } from './eksportMaterialow'
import type { PlikMaterialow } from './eksportMaterialow'
import type { RenderPodgladu } from '../TrybyPrezentacji'
import PodgladWydruku from './PodgladWydruku'

type Wlasciwosci = { render: RenderPodgladu | null; odbierzRender: (render: RenderPodgladu) => void; model: ModelPptx | null; nazwa: string; daneOkladki: DaneOkladki; czyZajety: boolean; ustawZajety: (wartosc: boolean) => void }
type RenderOkladki = { kluczDanych: string; bufor: ArrayBuffer }

export default function PanelEksportu({ model, nazwa, daneOkladki, czyZajety, ustawZajety, odbierzRender, render }: Wlasciwosci) {
  const [ustawienia, ustawUstawienia] = useState(domyslneUstawieniaDruku)
  const [okladki, ustawOkladki] = useState<Partial<Record<OrientacjaOkladki, RenderOkladki>>>({})
  const [zrodloOkladki, ustawZrodloOkladki] = useState<'szablon' | 'pierwszySlajd'>('szablon')
  const [blad, ustawBlad] = useState('')
  const [bledyEksportu, ustawBledyEksportu] = useState<string[]>([])
  const [postep, ustawPostep] = useState('')
  const blokada = useRef(false)
  const bufor = render?.model === model ? render.bufor : null
  const nazwaBazowa = nazwa.replace(/\.pptx$/i, '')
  const kluczDanych = JSON.stringify(daneOkladki)
  const wynikPlanu = useMemo(() => {
    if (!model) return { plan: [], blad: '' }
    try { return { plan: przygotujPlanDruku(model.slajdy.length, ustawienia), blad: '' } }
    catch (bladPlanu) { return { plan: [], blad: bladPlanu instanceof Error ? bladPlanu.message : 'Nieprawidłowe ustawienia druku.' } }
  }, [model, ustawienia])
  const plan = wynikPlanu.plan

  function zmienUstawienie<Klucz extends keyof UstawieniaDruku>(klucz: Klucz, wartosc: UstawieniaDruku[Klucz]) {
    ustawUstawienia((obecne) => ({ ...obecne, profil: 'reczny', [klucz]: wartosc }))
  }

  async function wykonaj(operacja: () => Promise<void>) {
    if (czyZajety || blokada.current) return
    blokada.current = true; ustawZajety(true); ustawBlad(''); ustawPostep('Przygotowywanie materiałów…')
    try { await operacja(); ustawPostep('Zakończono przygotowanie materiałów.') }
    catch (bladEksportu) {
      const opis = bladEksportu instanceof Error ? bladEksportu.message : 'Nie udało się przygotować materiałów.'
      console.error('[Poprawiacz prezentacji] Eksport i druk', opis)
      ustawBlad(opis); ustawPostep('')
      ustawBledyEksportu((obecne) => [...obecne.slice(-9), opis])
    }
    finally { blokada.current = false; ustawZajety(false) }
  }

  async function zapewnijPdf() {
    if (!model) throw new Error('Najpierw wczytaj prezentację PPTX.')
    if (bufor) return bufor
    ustawPostep('Renderowanie aktualnego PPTX lokalnie. To może potrwać kilka minut…')
    const wynik = await renderujPptxDoPdf(model)
    odbierzRender({ model, ...wynik })
    return wynik.bufor
  }

  async function zapewnijOkladke(orientacja: OrientacjaOkladki) {
    const dostepna = okladki[orientacja]
    if (dostepna?.kluczDanych === kluczDanych) return dostepna.bufor
    ustawPostep(`Renderowanie okładki ${orientacja === 'pionowa' ? 'pionowej' : 'poziomej'} SEMPER…`)
    const wypelniony = await przygotujOkladkeSemper(orientacja, daneOkladki)
    const wynik = await renderujPptxDoPdf(wypelniony)
    ustawOkladki((obecne) => ({ ...obecne, [orientacja]: { kluczDanych, bufor: wynik.bufor } }))
    return wynik.bufor
  }

  async function generujOkladke<T>(orientacja: OrientacjaOkladki, format: string, generuj: () => Promise<T>) {
    try { return await generuj() }
    catch (blad) {
      throw new Error(`Generowanie okładki (${orientacja}, ${format}). ${blad instanceof Error ? blad.message : 'Nieznany błąd.'}`, { cause: blad })
    }
  }

  async function pdfOkladki(orientacja: OrientacjaOkladki): Promise<PlikMaterialow> {
    return generujOkladke(orientacja, 'PDF A4', async () => {
      const prezentacja = zrodloOkladki === 'pierwszySlajd' ? model : null
      const pdf = prezentacja ? await zapewnijPdf() : await zapewnijOkladke(orientacja)
      const ustawieniaOkladki: UstawieniaDruku = { ...domyslneUstawieniaDruku(), profil: 'reczny', orientacja, dwustronnie: false, zakres: '1' }
      const [plik] = await wygenerujPdfDruku(pdf, przygotujPlanDruku(prezentacja?.slajdy.length ?? 1, ustawieniaOkladki), ustawPostep)
      return { nazwa: `okladka_${orientacja}.pdf`, plik: plik.plik }
    })
  }

  async function pngOkladki(orientacja: OrientacjaOkladki, pdf: PlikMaterialow): Promise<PlikMaterialow> {
    return generujOkladke(orientacja, 'PNG', async () => ({
      nazwa: `okladka_${orientacja}.png`,
      plik: await wygenerujPngOkladki(await pdf.plik.arrayBuffer(), orientacja === 'pozioma' ? 3508 : 2480),
    }))
  }

  async function plikiOkladki(orientacja: OrientacjaOkladki) {
    const pdf = await pdfOkladki(orientacja)
    return [pdf, await pngOkladki(orientacja, pdf)]
  }

  async function pobierzPptxOkladki(orientacja: OrientacjaOkladki) {
    const okladka = await generujOkladke(orientacja, 'PPTX', () => przygotujOkladkeSemper(orientacja, daneOkladki))
    const nazwa = `okladka_${orientacja}.pptx`
    let plik: Blob
    try { plik = await zapiszPptx(okladka) }
    catch (blad) { throw new Error(`Nie udało się zapisać pliku „${nazwa}”.`, { cause: blad }) }
    pobierzPlikMaterialow(plik, nazwa)
  }

  async function pobierzDruk() {
    const pliki = await wygenerujPdfDruku(await zapewnijPdf(), plan, ustawPostep)
    if (pliki.length === 1) pobierzPlikMaterialow(pliki[0].plik, `${nazwaBazowa}_${pliki[0].nazwa}`)
    else pobierzPlikMaterialow(await wygenerujKompletZip(pliki, plan.map((pozycja) => `${pozycja.nazwa}.pdf: ${zaleceniaDruku(pozycja.ustawienia)}`).join('\n\n')), `${nazwaBazowa}_DRUK.zip`)
  }

  return <>
    {model && <section className="narzedzia__panel" aria-labelledby="poprawiacz-eksport">
      <h2 id="poprawiacz-eksport">EKSPORT I DRUK</h2>
      <p>Profil {ustawienia.profil === 'automatyczny' ? model.slajdy.length <= 100 ? 'A: do 100 slajdów, jeden slajd na stronie' : 'B: osobna okładka i dwa slajdy na stronie' : 'ręczny'}.</p>
      <fieldset disabled={czyZajety} className="poprawiacz-prezentacji__pola">
        <legend>Ustawienia wydruku</legend>
        <label>Profil<select value={ustawienia.profil} onChange={(zdarzenie) => ustawUstawienia(zdarzenie.target.value === 'automatyczny' ? domyslneUstawieniaDruku() : { ...ustawienia, profil: 'reczny', slajdowNaStronie: model.slajdy.length > 100 ? 2 : 1 })}><option value="automatyczny">Automatyczny SEMPER</option><option value="reczny">Ręczny</option></select></label>
        <label>Format papieru<select value={ustawienia.papier} onChange={(zdarzenie) => zmienUstawienie('papier', zdarzenie.target.value as UstawieniaDruku['papier'])}>{['A4', 'A3', 'Letter'].map((papier) => <option key={papier}>{papier}</option>)}</select></label>
        <label>Orientacja<select value={ustawienia.orientacja} onChange={(zdarzenie) => zmienUstawienie('orientacja', zdarzenie.target.value as UstawieniaDruku['orientacja'])}><option value="pozioma">Pozioma</option><option value="pionowa">Pionowa</option></select></label>
        <label>Liczba slajdów na stronie<select value={ustawienia.profil === 'automatyczny' && model.slajdy.length > 100 ? 2 : ustawienia.slajdowNaStronie} onChange={(zdarzenie) => zmienUstawienie('slajdowNaStronie', Number(zdarzenie.target.value) as 1 | 2)}><option value="1">1</option><option value="2">2</option></select></label>
        <label>Zakres slajdów<input placeholder="Wszystkie, np. 1-10, 15" value={ustawienia.zakres} onChange={(zdarzenie) => zmienUstawienie('zakres', zdarzenie.target.value)} /></label>
        <label>Marginesy (mm)<input type="number" min="0" max="50" value={ustawienia.marginesMm} onChange={(zdarzenie) => zmienUstawienie('marginesMm', zdarzenie.target.valueAsNumber)} /></label>
        <label className="poprawiacz-prezentacji__wybor"><input type="checkbox" role="switch" checked={ustawienia.dwustronnie} onChange={(zdarzenie) => zmienUstawienie('dwustronnie', zdarzenie.target.checked)} />Druk dwustronny</label>
        <label>Odwracanie kartek<select value={ustawienia.odwracanie} disabled={!ustawienia.dwustronnie} onChange={(zdarzenie) => zmienUstawienie('odwracanie', zdarzenie.target.value as UstawieniaDruku['odwracanie'])}><option value="dluga">Dłuższa krawędź</option><option value="krotka">Krótsza krawędź</option></select></label>
        <label>Tryb kolorowy<select value={ustawienia.kolor} onChange={(zdarzenie) => zmienUstawienie('kolor', zdarzenie.target.value as UstawieniaDruku['kolor'])}><option value="kolorowy">Kolorowy</option><option value="szary">Skala szarości</option></select></label>
        <label className="poprawiacz-prezentacji__wybor"><input type="checkbox" role="switch" checked={ustawienia.pustaStronaNaKoncu} onChange={(zdarzenie) => zmienUstawienie('pustaStronaNaKoncu', zdarzenie.target.checked)} />Dodaj pustą stronę na końcu nieparzystego pliku dwustronnego</label>
      </fieldset>
      {wynikPlanu.blad && <p role="alert">{wynikPlanu.blad}</p>}
      {plan.map((pozycja) => <p key={pozycja.nazwa}>{pozycja.nazwa}.pdf: {pozycja.strony.length} stron. {zaleceniaDruku(pozycja.ustawienia)}</p>)}
      <div className="poprawiacz-prezentacji__akcje">
        <button type="button" disabled={czyZajety} onClick={() => void wykonaj(async () => pobierzPlikMaterialow(await zapiszPptx(model), nazwaPoprawionejPrezentacji(nazwa)))}>Pobierz PPTX</button>
        <button type="button" disabled={czyZajety} onClick={() => void wykonaj(async () => pobierzPlikMaterialow(new Blob([await zapewnijPdf()], { type: 'application/pdf' }), `${nazwaBazowa}.pdf`))}>Pobierz PDF</button>
        <button type="button" disabled={czyZajety || !plan.length} onClick={() => void wykonaj(pobierzDruk)}>Pobierz PDF do druku</button>
        <button type="button" disabled={czyZajety || !plan.length} onClick={() => void wykonaj(async () => { await zapewnijPdf() })}>Przygotuj podgląd wydruku</button>
        <button type="button" disabled={czyZajety || !plan.length} onClick={() => void wykonaj(async () => {
          const aktualnyPdf = await zapewnijPdf()
          const pliki: PlikMaterialow[] = [{ nazwa: nazwaPoprawionejPrezentacji(nazwa), plik: await zapiszPptx(model) }, { nazwa: `${nazwaBazowa}_PREZENTACJA.pdf`, plik: new Blob([aktualnyPdf], { type: 'application/pdf' }) }, ...await wygenerujPdfDruku(aktualnyPdf, plan, ustawPostep), ...await plikiOkladki('pionowa'), ...await plikiOkladki('pozioma')]
          pobierzPlikMaterialow(await wygenerujKompletZip(pliki, plan.map((pozycja) => `${pozycja.nazwa}: ${zaleceniaDruku(pozycja.ustawienia)}`).join('\n\n')), `${nazwaBazowa}_KOMPLET.zip`)
        })}>Pobierz komplet ZIP</button>
      </div>
      <label>Wczytaj PDF aktualnego PPTX (wszystkie slajdy)<input type="file" accept=".pdf" disabled={czyZajety} onChange={(zdarzenie) => {
        const plik = zdarzenie.target.files?.[0]; zdarzenie.target.value = ''
        if (plik) void wykonaj(async () => { const dane = await plik.arrayBuffer(); await sprawdzPdfPrezentacji(dane, model.slajdy.length); odbierzRender({ model, bufor: dane, uwagi: ['PDF wczytano ręcznie. Sprawdź zgodność jego treści i kolejności z aktualnym PPTX.'] }) })
      }} /></label>
      <p className="narzedzia__opis">Windows desktop: lokalny PowerPoint lub LibreOffice. Linux desktop: lokalny LibreOffice. W przeglądarce i na Androidzie wczytaj PDF wyeksportowany ze wszystkich slajdów aktualnego PPTX.</p>
      {render?.model === model && render.uwagi.length > 0 && <details open><summary>Uwagi z renderowania ({render.uwagi.length})</summary><ul className="poprawiacz-prezentacji__lista">{render.uwagi.map((uwaga, indeks) => <li key={indeks}>{uwaga}</li>)}</ul></details>}
    </section>}
    <section className="narzedzia__panel" aria-label="Generator okładek SEMPER">
      <h2>Okładki SEMPER — osobne kompozycje z wzorców</h2>
      <p>Okładki korzystają z danych szkolenia powyżej oraz oryginalnych grafik, logo i kodów QR. Pion i poziom mają osobne szablony.</p>
      {model && <label>Źródło okładki<select disabled={czyZajety} value={zrodloOkladki} onChange={(zdarzenie) => ustawZrodloOkladki(zdarzenie.target.value as typeof zrodloOkladki)}><option value="szablon">Szablony SEMPER — osobna kompozycja pionowa i pozioma</option><option value="pierwszySlajd">Pierwszy slajd — cała treść, proporcjonalne dopasowanie do A4</option></select></label>}
      {zrodloOkladki === 'pierwszySlajd' && <p>Edytowalny PPTX jest dostępny dla okładek z szablonów SEMPER.</p>}
      {(['pionowa', 'pozioma'] as const).map((orientacja) => <fieldset key={orientacja} disabled={czyZajety} className="poprawiacz-prezentacji__pola"><legend>Okładka {orientacja}</legend>
        <div className="poprawiacz-prezentacji__akcje"><button type="button" onClick={() => void wykonaj(async () => { const pdf = await pdfOkladki(orientacja); pobierzPlikMaterialow(pdf.plik, pdf.nazwa) })}>Pobierz okładkę {orientacja === 'pionowa' ? 'pionową' : 'poziomą'} — PDF A4</button>
          <button type="button" onClick={() => void wykonaj(async () => { const png = await pngOkladki(orientacja, await pdfOkladki(orientacja)); pobierzPlikMaterialow(png.plik, png.nazwa) })}>Pobierz PNG — {orientacja}</button>
          {zrodloOkladki === 'szablon' && <button type="button" onClick={() => void wykonaj(() => pobierzPptxOkladki(orientacja))}>Pobierz edytowalną okładkę PPTX</button>}</div>
        <label>Wczytaj PDF tej okładki po eksporcie z PowerPoint<input type="file" accept=".pdf" onChange={(zdarzenie) => {
          const plik = zdarzenie.target.files?.[0]; zdarzenie.target.value = ''
          if (plik) void wykonaj(async () => {
            const dane = await plik.arrayBuffer(); await sprawdzPdfPrezentacji(dane, 1)
            const dokument = await otworzPdfPrezentacji(dane)
            try { const widok = (await dokument.getPage(1)).getViewport({ scale: 1 }); if ((widok.width > widok.height) !== (orientacja === 'pozioma')) throw new Error('Orientacja PDF nie odpowiada wybranej okładce.') }
            finally { await dokument.loadingTask.destroy() }
            ustawOkladki((obecne) => ({ ...obecne, [orientacja]: { kluczDanych, bufor: dane } }))
          })
        }} /></label>
      </fieldset>)}
    </section>
    {blad && <p role="alert">{blad}</p>}{postep && <p role="status">{postep}</p>}
    {bledyEksportu.length > 0 && <details><summary>Diagnostyka eksportu ({bledyEksportu.length})</summary>
      <ul>{bledyEksportu.map((opis, indeks) => <li key={indeks}>{opis}</li>)}</ul>
    </details>}
    {bufor && plan.length > 0 && <PodgladWydruku bufor={bufor} plan={plan} />}
  </>
}
