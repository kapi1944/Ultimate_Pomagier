import { invoke, isTauri } from '@tauri-apps/api/core'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { ModelPptx } from '../pptx/modelPptx'

export async function otworzPdfPrezentacji(bufor: ArrayBuffer) {
  const biblioteka = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { default: adresPracownikaPdf } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  biblioteka.GlobalWorkerOptions.workerSrc = adresPracownikaPdf
  const zadanie = biblioteka.getDocument({ data: new Uint8Array(bufor.slice(0)) })
  try { return await zadanie.promise }
  catch (blad) { await zadanie.destroy(); throw blad }
}

export async function sprawdzPdfPrezentacji(bufor: ArrayBuffer, liczbaSlajdow: number) {
  const dokument = await otworzPdfPrezentacji(bufor)
  try {
    if (dokument.numPages !== liczbaSlajdow) throw new Error(`PDF ma ${dokument.numPages} stron, a prezentacja ${liczbaSlajdow} slajdów. Wczytaj PDF ze wszystkimi slajdami, także ukrytymi.`)
  } finally { await dokument.loadingTask.destroy() }
}

const renderyWToku = new WeakMap<ModelPptx, ReturnType<typeof uruchomRenderPptx>>()

export async function czyPlatformaRenderujePptx() {
  if (!isTauri()) return false
  const platforma = await invoke<{ system: string }>('informacje_o_platformie')
  return ['windows', 'linux'].includes(platforma.system)
}

export function renderujPptxDoPdf(model: ModelPptx) {
  const renderWToku = renderyWToku.get(model)
  if (renderWToku) return renderWToku
  const render = uruchomRenderPptx(model).finally(() => renderyWToku.delete(model))
  renderyWToku.set(model, render)
  return render
}

async function uruchomRenderPptx(model: ModelPptx) {
  if (!isTauri()) throw new Error('Automatyczne renderowanie PPTX jest dostępne w aplikacji desktop. W przeglądarce i Androidzie wczytaj PDF zapisany z aktualnej kopii PPTX.')
  if (!await czyPlatformaRenderujePptx()) throw new Error('Na tym urządzeniu wczytaj PDF zapisany z aktualnej kopii PPTX. Automatyczne renderowanie wymaga aplikacji desktop Windows lub Linux.')
  let odpowiedz: ArrayBuffer | number[]
  try { odpowiedz = await invoke('renderuj_prezentacje', model.buforZrodlowy) }
  catch (blad) { throw new Error(typeof blad === 'string' ? blad : 'Nie udało się wyrenderować PPTX lokalnie.', { cause: blad }) }
  const wynik = Array.isArray(odpowiedz) ? new Uint8Array(odpowiedz).buffer : odpowiedz
  if (!(wynik instanceof ArrayBuffer) || wynik.byteLength < 4) throw new Error('Renderer zwrócił niepoprawną odpowiedź.')
  const koniecOpisu = 4 + new DataView(wynik).getUint32(0, true)
  if (koniecOpisu >= wynik.byteLength) throw new Error('Renderer nie zwrócił pliku PDF.')
  const opis: { silnik: 'PowerPoint' | 'LibreOffice'; uwagi: string[] } = JSON.parse(new TextDecoder().decode(new Uint8Array(wynik, 4, koniecOpisu - 4)))
  const bufor = wynik.slice(koniecOpisu)
  await sprawdzPdfPrezentacji(bufor, model.slajdy.length)
  return { bufor, ...opis }
}

export async function renderujStronePdf(dokument: PDFDocumentProxy, numer: number, szerokoscPikseli: number, czySzara = false, sygnal?: AbortSignal, proporcjaSlajdu?: number) {
  sygnal?.throwIfAborted()
  const strona = await dokument.getPage(numer)
  const oryginal = strona.getViewport({ scale: 1 })
  if (proporcjaSlajdu && Math.abs(oryginal.width / oryginal.height / proporcjaSlajdu - 1) > .005) {
    strona.cleanup()
    throw new Error(`Strona ${numer} PDF ma inne proporcje niż slajd PPTX. Wczytaj PDF wyeksportowany bezpośrednio ze slajdów, bez dopasowania do papieru.`)
  }
  const widok = strona.getViewport({ scale: szerokoscPikseli / oryginal.width })
  const plotno = document.createElement('canvas')
  plotno.width = Math.ceil(szerokoscPikseli); plotno.height = Math.ceil(widok.height)
  const kontekst = plotno.getContext('2d')
  if (!kontekst) throw new Error('Nie można utworzyć podglądu PDF.')
  const zadanie = strona.render({ canvasContext: kontekst, canvas: plotno, viewport: widok, background: '#ffffff' })
  const anuluj = () => zadanie.cancel()
  sygnal?.addEventListener('abort', anuluj, { once: true })
  try { sygnal?.throwIfAborted(); await zadanie.promise }
  finally { sygnal?.removeEventListener('abort', anuluj); strona.cleanup() }
  if (czySzara) {
    const obraz = kontekst.getImageData(0, 0, plotno.width, plotno.height)
    for (let indeks = 0; indeks < obraz.data.length; indeks += 4) {
      const szarosc = Math.round(.2126 * obraz.data[indeks] + .7152 * obraz.data[indeks + 1] + .0722 * obraz.data[indeks + 2])
      obraz.data[indeks] = szarosc; obraz.data[indeks + 1] = szarosc; obraz.data[indeks + 2] = szarosc
    }
    kontekst.putImageData(obraz, 0, 0)
  }
  strona.cleanup()
  return plotno
}
