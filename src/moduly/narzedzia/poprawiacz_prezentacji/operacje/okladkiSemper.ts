import type { DaneOkladki } from './mapowanieDanych'
import { wartoscPola, zastapTekstObiektu } from './mapowanieDanych'
import { otworzPptx } from '../pptx/otworzPptx'
import { odczytajRelacje } from '../pptx/relacjePptx'
import { dzieckoXml, dzieciXml, potomkowieXml, przestrzeniePptx } from '../pptx/xmlPptx'
import type { ModelPptx } from '../pptx/modelPptx'
import { zapiszZmianyPptx } from '../pptx/zmianyPptx'

export type OrientacjaOkladki = 'pionowa' | 'pozioma'

async function sprawdzGrafikiOkladki(model: ModelPptx) {
  const slajd = model.slajdy[0]
  const brakujace = new Set<string>()
  const grafiki = new Set<string>()
  for (const czesc of [slajd.czesc, slajd.czescUkladu, slajd.czescWzorca]) {
    if (!czesc) continue
    const dokument = model.czesciXml.get(czesc)
    if (!dokument) { brakujace.add(czesc); continue }
    const sciezkaRelacji = czesc.replace(/([^/]+)$/, '_rels/$1.rels')
    const dokumentRelacji = model.czesciXml.get(sciezkaRelacji)
    const relacje = dokumentRelacji ? odczytajRelacje(dokumentRelacji, czesc) : []
    for (const obraz of [...potomkowieXml(dokument, 'blip'), ...potomkowieXml(dokument, 'svgBlip')]) {
      for (const id of przestrzeniePptx.relacje.flatMap((przestrzen) => ['embed', 'link']
        .map((atrybut) => obraz.getAttributeNS(przestrzen, atrybut))).filter(Boolean)) {
        const cel = relacje.find((relacja) => relacja.id === id && relacja.typ.endsWith('/image'))?.cel
        if (cel) grafiki.add(cel)
        else {
          const surowa = dokumentRelacji && potomkowieXml(dokumentRelacji, 'Relationship').find((relacja) => relacja.getAttribute('Id') === id)
          brakujace.add(surowa?.getAttribute('TargetMode') === 'External'
            ? `${sciezkaRelacji} (${id}: grafika zewnętrzna)` : `${sciezkaRelacji} (${id})`)
        }
      }
    }
  }
  for (const sciezka of grafiki) {
    const plik = model.archiwum.file(sciezka)
    if (!plik || !(await plik.async('uint8array')).length) brakujace.add(sciezka)
  }
  if (brakujace.size) throw new Error(`Brak oryginalnych zasobów graficznych SEMPER: ${[...brakujace].join(', ')}.`)
  if (!grafiki.size) throw new Error(`Brak grafik w szablonie SEMPER (${slajd.czesc}).`)
}

export async function wypelnijSzablonOkladki(bufor: ArrayBuffer, orientacja: OrientacjaOkladki, dane: DaneOkladki) {
  if (!dane.tytul.trim()) throw new Error('Uzupełnij nazwę szkolenia dla okładki SEMPER.')
  const model = await otworzPptx(bufor)
  await sprawdzGrafikiOkladki(model)
  const slajd = model.slajdy[0]
  const pola = orientacja === 'pionowa'
    ? { tytul: '6', data: '33', trener: '22' } : { tytul: '29717', data: '33', trener: '22' }
  const trener = orientacja === 'pionowa' ? ['Ekspert Merytoryczny:', dane.trener, dane.emailTrenera].filter(Boolean).join('\n') : wartoscPola('trenerIEmail', dane)
  for (const [id, tekst] of [[pola.tytul, dane.tytul], [pola.data, wartoscPola('dataIMiejscowosc', dane)], [pola.trener, trener]] as const) {
    const obiekt = slajd.obiekty.find((pozycja) => pozycja.id === id)
    if (!obiekt) throw new Error('Szablon SEMPER nie zawiera oczekiwanego pola.')
    zastapTekstObiektu(obiekt, tekst)
  }
  const prezentacja = model.czesciXml.get('ppt/presentation.xml')!
  const listaSlajdow = dzieckoXml(prezentacja.documentElement, 'sldIdLst')
  if (!listaSlajdow) throw new Error('Szablon SEMPER nie zawiera listy slajdów.')
  for (const element of dzieciXml(listaSlajdow, 'sldId').slice(1)) listaSlajdow.removeChild(element)
  return zapiszZmianyPptx(model, new Map([[slajd.czesc, slajd.dokument], ['ppt/presentation.xml', prezentacja]]))
}

export async function przygotujOkladkeSemper(orientacja: OrientacjaOkladki, dane: DaneOkladki) {
  const sciezka = `szablony/prezentacje/semper-${orientacja === 'pionowa' ? 'pion' : 'poziom'}.pptx`
  const bladOdczytu = (blad: unknown): never => {
    throw new Error(`Nie udało się odczytać pliku szablonu SEMPER: ${sciezka}.`, { cause: blad })
  }
  const odpowiedz = await fetch(`${import.meta.env.BASE_URL}${sciezka}`).catch(bladOdczytu)
  if (odpowiedz.status === 404 || odpowiedz.headers.get('content-type')?.includes('text/html')) {
    throw new Error(`Brak pliku szablonu SEMPER: ${sciezka}.`)
  }
  if (!odpowiedz.ok) throw new Error(`Nie udało się odczytać pliku szablonu SEMPER: ${sciezka} (HTTP ${odpowiedz.status}).`)
  return wypelnijSzablonOkladki(await odpowiedz.arrayBuffer().catch(bladOdczytu), orientacja, dane)
}
