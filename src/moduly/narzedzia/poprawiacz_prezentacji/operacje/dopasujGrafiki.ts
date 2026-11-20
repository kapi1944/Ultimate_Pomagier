import JSZip from 'jszip'
import { czyNumerSlajdu, czyObiektGlowny, czyOkladka, czyPrzeciecie, znajdzNaglowek } from '../analiza/analizujUklad'
import type { GeometriaPptx, ModelPptx, ObiektSlajdu, SlajdPptx } from '../pptx/modelPptx'
import { otworzPptx } from '../pptx/otworzPptx'
import { odczytajObiektySlajdu } from '../pptx/slajdyPptx'
import { dzieckoXml, potomkowieXml } from '../pptx/xmlPptx'
import { czyObiektPowiazany, ustawGeometrie, zapiszZmianyPptx } from '../pptx/zmianyPptx'

type Wpis = {
  slajd: number; id: string; nazwa: string; przyczyna: string
  czyKolizja: boolean
  status: 'poprawione' | 'już poprawne' | 'celowo pełnoekranowe' | 'wymaga oceny'
  przed: GeometriaPptx | null; po?: GeometriaPptx; skala?: number
}

function granice(obiekt: ObiektSlajdu) {
  const geometria = obiekt.geometria
  if (!geometria) return null
  const kat = Number(potomkowieXml(obiekt.element, 'xfrm')[0]?.getAttribute('rot')) / 60000 * Math.PI / 180
  if (!kat) return geometria
  const cx = Math.abs(Math.cos(kat)) * geometria.cx + Math.abs(Math.sin(kat)) * geometria.cy
  const cy = Math.abs(Math.sin(kat)) * geometria.cx + Math.abs(Math.cos(kat)) * geometria.cy
  return { x: geometria.x + (geometria.cx - cx) / 2, y: geometria.y + (geometria.cy - cy) / 2, cx, cy }
}

function znajdzMiejsce(przed: GeometriaPptx, ramka: GeometriaPptx, przeszkody: GeometriaPptx[], odstep: number) {
  let wolne = [ramka]
  for (const przeszkoda of przeszkody) {
    const { x, y, cx, cy } = przeszkoda
    wolne = wolne.flatMap((pole) => {
      if (!czyPrzeciecie(pole, przeszkoda, odstep)) return [pole]
      return [
        { ...pole, cx: Math.min(pole.cx, x - odstep - pole.x) },
        { ...pole, x: x + cx + odstep, cx: pole.x + pole.cx - x - cx - odstep },
        { ...pole, cy: Math.min(pole.cy, y - odstep - pole.y) },
        { ...pole, y: y + cy + odstep, cy: pole.y + pole.cy - y - cy - odstep },
      ].filter((kandydat) => kandydat.cx > 0 && kandydat.cy > 0)
    })
    if (wolne.length > 512) return undefined
  }
  return wolne.map((pole) => {
    const skala = Math.min(1, pole.cx / przed.cx, pole.cy / przed.cy)
    const cx = Math.floor(przed.cx * skala), cy = Math.floor(przed.cy * skala)
    const x = Math.round(Math.max(pole.x, Math.min(przed.x + (przed.cx - cx) / 2, pole.x + pole.cx - cx)))
    const y = Math.round(Math.max(pole.y, Math.min(przed.y + (przed.cy - cy) / 2, pole.y + pole.cy - cy)))
    return { po: { x, y, cx, cy }, skala, odleglosc: Math.hypot(x - przed.x, y - przed.y) }
  }).filter(({ po }) => po.x >= 0 && po.y >= 0 && po.x + po.cx <= ramka.cx && po.y + po.cy <= ramka.cy
    && !przeszkody.some((przeszkoda) => czyPrzeciecie(po, przeszkoda, odstep)))
    .sort((a, b) => b.skala - a.skala || a.odleglosc - b.odleglosc)[0]
}

function analizujGrafiki(model: ModelPptx, slajd: SlajdPptx, odstep: number): Wpis[] {
  const lokalne = slajd.obiekty.filter(czyObiektGlowny)
  const obrazy = lokalne.filter((obiekt) => obiekt.typ === 'obraz' || obiekt.typ === 'grupa')
  const typUkladu = model.czesciXml.get(slajd.czescUkladu ?? '')?.documentElement.getAttribute('type') ?? ''
  const okladka = czyOkladka(slajd) || ['title', 'secHead'].includes(typUkladu)
  const naglowek = znajdzNaglowek(slajd)
  const chronione = [...slajd.elementyWzorca.filter(czyObiektGlowny), ...lokalne.filter((obiekt) =>
    obiekt === naglowek || czyNumerSlajdu(obiekt) || ['title', 'ctrTitle', 'subTitle', 'hdr', 'ftr', 'dt'].includes(obiekt.pole?.typ ?? '')
    || /logo|nagłówek|header|stopka|footer|numeracja|slide number/i.test(obiekt.nazwa))]
  const ramka = { x: 0, y: 0, cx: slajd.szerokosc, cy: slajd.wysokosc }
  const kolizja = (obiekt: ObiektSlajdu) => {
    const pole = granice(obiekt)
    return pole && (pole.x < 0 || pole.y < 0 || pole.x + pole.cx > ramka.cx || pole.y + pole.cy > ramka.cy
      || chronione.some((element) => element !== obiekt && granice(element) && czyPrzeciecie(pole, granice(element)!)))
  }
  const konflikty = obrazy.filter((obiekt) => !chronione.includes(obiekt) && kolizja(obiekt))
  return obrazy.map((obiekt) => {
    const przed = obiekt.geometria
    const wpis = { slajd: slajd.numer, id: obiekt.id, nazwa: obiekt.nazwa, przed, czyKolizja: !okladka && konflikty.includes(obiekt) }
    const ocena = (przyczyna: string): Wpis => ({ ...wpis, status: 'wymaga oceny', przyczyna })
    if (okladka && przed && przed.cx >= ramka.cx * .95 && przed.cy >= ramka.cy * .95) {
      return { ...wpis, status: 'celowo pełnoekranowe', przyczyna: 'Pełnoekranowa grafika na okładce lub slajdzie działowym.' }
    }
    if (chronione.includes(obiekt)) return { ...wpis, status: 'już poprawne', przyczyna: 'Chroniony element slajdu.' }
    if (!przed || !obiekt.czyProstaGeometria) return ocena('Brak pewnych granic wizualnych obiektu.')
    if (!konflikty.includes(obiekt)) return { ...wpis, status: 'już poprawne', przyczyna: 'Brak wykrytej kolizji.' }
    const elementy = [obiekt, ...slajd.obiekty.filter((element) => element.klucz.startsWith(obiekt.klucz + '/'))]
    const transformacja = dzieckoXml(dzieckoXml(obiekt.element, obiekt.typ === 'grupa' ? 'grpSpPr' : 'spPr'), 'xfrm')
    const czyZlozony = elementy.some((element) => !element.czyProstaGeometria || !element.geometria
      || czyObiektPowiazany(slajd.dokument, element.id)
      || potomkowieXml(element.element, 'cNvPr').some((dane) => ['1', 'true'].includes(dane.getAttribute('hidden') ?? ''))
      || potomkowieXml(element.element, 'ext').some((rozszerzenie) => rozszerzenie.hasAttribute('uri')
        && !['{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}', '{28A0092B-C50C-407E-A947-70E740481C1C}'].includes(rozszerzenie.getAttribute('uri') ?? ''))
      || potomkowieXml(element.element, 'effectRef').some((efekt) => Number(efekt.getAttribute('idx')) > 0)
      || ['outerShdw', 'innerShdw', 'glow', 'softEdge', 'scene3d'].some((nazwa) => potomkowieXml(element.element, nazwa).length > 0))
    if (okladka || !transformacja || czyZlozony || konflikty.length > 1 || przed.cx < ramka.cx * .25) {
      return ocena('Niepewna kompozycja, złożony obiekt lub kilka konkurujących grafik.')
    }
    if (obiekt.typ === 'grupa' && (elementy.length < 2 || elementy.slice(1).some(({ geometria }) => !geometria
      || geometria.x < przed.x || geometria.y < przed.y || geometria.x + geometria.cx > przed.x + przed.cx
      || geometria.y + geometria.cy > przed.y + przed.cy))) return ocena('Zawartość grupy wykracza poza jej ramkę.')
    const pozostale = [...new Set([...chronione, ...lokalne])].filter((element) => element !== obiekt)
    if (pozostale.some((element) => !element.geometria || !element.czyProstaGeometria)
      || potomkowieXml(slajd.dokument, 'AlternateContent').length) return ocena('Nie udało się ustalić granic wszystkich elementów slajdu.')
    const trafienia = chronione.filter((element) => granice(element) && czyPrzeciecie(przed, granice(element)!))
    if (!trafienia.length) return ocena('Wyjście poza slajd może stanowić część zamierzonej kompozycji.')
    const miejsce = znajdzMiejsce(przed, ramka, pozostale.map((element) => granice(element)!), odstep)
    if (!miejsce || miejsce.skala < .75) return ocena('Brak wolnego miejsca lub ryzyko utraty czytelności po zmniejszeniu.')
    return { ...wpis, po: miejsce.po, skala: miejsce.skala, status: 'poprawione',
      przyczyna: `Kolizja: ${trafienia.map((element) => element.nazwa || element.id).join(', ')}` }
  })
}

export async function dopasujGrafiki(model: ModelPptx, buforCm = .2) {
  if (!Number.isFinite(buforCm) || buforCm < 0) throw new Error('Bufor musi być nieujemną liczbą.')
  const kopia = await otworzPptx(model.buforZrodlowy)
  const zmiany = new Map<string, Document>()
  const raporty = new Map<string, Wpis[]>()
  const wpisy = kopia.slajdy.flatMap((slajd) => {
    const raport = analizujGrafiki(kopia, slajd, Math.round(buforCm * 360000))
    if (raport.some((wpis) => wpis.status === 'wymaga oceny')) {
      return raport.map((wpis): Wpis => wpis.po ? {
        ...wpis, po: undefined, skala: undefined, status: 'wymaga oceny', przyczyna: 'Inny obiekt na slajdzie wymaga oceny.',
      } : wpis)
    }
    for (const wpis of raport) {
      if (!wpis.po) continue
      const obiekty = slajd.obiekty.filter((obiekt) => obiekt.id === wpis.id)
      if (!wpis.id || obiekty.length !== 1) throw new Error('Brak jednoznacznego identyfikatora grafiki.')
      ustawGeometrie(obiekty[0], wpis.po)
      zmiany.set(slajd.czesc, slajd.dokument)
      raporty.set(slajd.czesc, raport)
    }
    return raport
  })
  const wynik = zmiany.size ? await zapiszZmianyPptx(kopia, zmiany) : model
  if (zmiany.size) {
    const archiwum = await JSZip.loadAsync(wynik.buforZrodlowy, { checkCRC32: true })
    const pliki = Object.keys(kopia.archiwum.files).filter((nazwa) => !kopia.archiwum.files[nazwa].dir)
    if (pliki.length !== Object.values(archiwum.files).filter((plik) => !plik.dir).length
      || wynik.slajdy.length !== model.slajdy.length
      || wynik.slajdy.some((slajd, indeks) => slajd.czesc !== model.slajdy[indeks].czesc)) throw new Error('Zmieniła się struktura prezentacji.')
    for (const nazwa of pliki) {
      const plik = archiwum.file(nazwa)
      const dokument = zmiany.get(nazwa)
      if (dokument) {
        if (await plik?.async('string') !== new XMLSerializer().serializeToString(dokument)) throw new Error(`Nieprawidłowa korekta: ${nazwa}.`)
        const odtworzony = wynik.czesciXml.get(nazwa)!.cloneNode(true) as Document
        const obiekty = odczytajObiektySlajdu(odtworzony)
        for (const wpis of raporty.get(nazwa)!) {
          if (!wpis.po) continue
          const obiekt = obiekty.find((element) => element.id === wpis.id)
          if (!obiekt || JSON.stringify(obiekt.geometria) !== JSON.stringify(wpis.po)) throw new Error(`Nieprawidłowa geometria: ${nazwa}.`)
          ustawGeometrie(obiekt, wpis.przed!)
        }
        if (new XMLSerializer().serializeToString(odtworzony) !== new XMLSerializer().serializeToString(model.czesciXml.get(nazwa)!)) {
          throw new Error(`Wykryto zmiany poza transformacją grafik: ${nazwa}.`)
        }
      } else {
        const przed = await kopia.archiwum.file(nazwa)!.async('uint8array')
        const po = await plik?.async('uint8array')
        if (!po || przed.length !== po.length || przed.some((bajt, indeks) => bajt !== po[indeks])) throw new Error(`Zmieniono chronioną część: ${nazwa}.`)
      }
    }
  }
  return { model: wynik, wpisy, slajdy: kopia.slajdy.length, zmienioneSlajdy: zmiany.size }
}
