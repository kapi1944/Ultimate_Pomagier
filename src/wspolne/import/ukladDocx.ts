/**
 * Wierny układ stron dokumentu DOCX dla importu dokumentów o swobodnym układzie
 * (certyfikaty, dyplomy, zaświadczenia, karty itp.).
 *
 * W odróżnieniu od uproszczonego układu przepływowego (stała szerokość 170 mm,
 * wysokość akapitu liczona z liczby znaków) ten moduł odtwarza geometrię z XML:
 * - rozmiar i marginesy strony z `w:sectPr` (`w:pgSz`, `w:pgMar`, odległość nagłówka/stopki),
 * - odstępy akapitów i interlinię (`w:spacing` before/after/line/lineRule) z docDefaults, stylów i akapitu,
 * - wysokość wiersza z największej czcionki w wierszu oraz z czcionki znaku akapitu dla pustych akapitów,
 * - puste akapity (Word używa ich jako „odstępów” – nie wolno ich pomijać),
 * - miękkie złamania wiersza `w:br`, tabulatory i wcięcia (`w:tabs`, `w:ind`, `defaultTabStop`),
 * - obrazy pływające (`wp:anchor`) i w tekście (`wp:inline`) z rzeczywistym rozmiarem `wp:extent` (EMU).
 */
import type {
  ElementDokumentu,
  ElementObrazuDokumentu,
  ElementTekstowyDokumentu,
  RolaGrafikiDokumentu,
  StronaDokumentu,
  StylTekstuDokumentu,
} from '../dokumenty/typyDokumentu'

export const nsW = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const nsWp = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
const nsA = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const nsR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const MM_NA_TWIP = 25.4 / 1440
const MM_NA_EMU = 1 / 36000
export const MM_NA_PT = 25.4 / 72

export type GrafikaUkladuDocx = {
  id: string
  nazwa: string
  zrodlo: string
  rola: RolaGrafikiDokumentu
}

/** Pobiera grafikę po identyfikatorze relacji w danej części DOCX. */
export type PobieranieGrafikiDocx = (idRelacji: string, rolaDomyslna: RolaGrafikiDokumentu) => Promise<GrafikaUkladuDocx | null>

export type CzescUkladuDocx = {
  wezelTresci: Element
  pobierzGrafike: PobieranieGrafikiDocx
}

export type UstawieniaStronyDocx = {
  szerokoscMm: number
  wysokoscMm: number
  marginesGornyMm: number
  marginesDolnyMm: number
  marginesLewyMm: number
  marginesPrawyMm: number
  odlegloscNaglowkaMm: number
  odlegloscStopkiMm: number
}

type WlasciwosciRunu = {
  kroj?: string
  rozmiarPt?: number
  pogrubienie?: boolean
  kursywa?: boolean
  podkreslenie?: boolean
  kolor?: string
}

type RegulaLinii = 'auto' | 'exact' | 'atLeast'

type WlasciwosciAkapitu = {
  przedPt?: number
  poPt?: number
  liniaWartosc?: number
  regulaLinii?: RegulaLinii
  wyrownanie?: StylTekstuDokumentu['wyrownanie']
  wciecieLeweMm?: number
  wciecieProweMm?: number
  wciecieePierwszegoWierszaMm?: number
  tabulatoryMm?: number[]
  rPrZnakuAkapitu?: WlasciwosciRunu
  stylId?: string
}

type StylDocx = {
  id: string
  typ: string
  bazowy?: string
  pPr: WlasciwosciAkapitu
  rPr: WlasciwosciRunu
}

export type KontekstStylowDocx = {
  domyslneRunu: WlasciwosciRunu
  domyslneAkapitu: WlasciwosciAkapitu
  style: Map<string, StylDocx>
  domyslnyStylAkapitu?: string
  domyslnyTabulatorMm: number
  fontMotywuPodrzedny: string
  fontMotywuGlowny: string
}

type FragmentWiersza = {
  tekst: string
  wlasciwosci: Required<Pick<WlasciwosciRunu, 'kroj' | 'rozmiarPt'>> & WlasciwosciRunu
}

type WierszAkapitu = {
  fragmenty: FragmentWiersza[]
}

export type WynikUkladuCzesci = {
  elementy: ElementDokumentu[]
  /** Pozycja Y (mm) po ostatnim akapicie. */
  y: number
  /** Elementy pozycjonowane względem strony – nie przesuwać przy kotwiczeniu stopki. */
  elementyBezwzgledne: Set<string>
  przerwyStron: number[]
  ostrzezenia: string[]
}

// ——— pomocnicze XML ———

function dzieciW(wezel: Element | null | undefined, nazwa?: string): Element[] {
  if (!wezel) {
    return []
  }

  return Array.from(wezel.childNodes).filter(
    (dziecko): dziecko is Element => dziecko.nodeType === 1 && (!nazwa || ((dziecko as Element).localName === nazwa && (dziecko as Element).namespaceURI === nsW)),
  )
}

function dzieckoW(wezel: Element | null | undefined, nazwa: string) {
  return dzieciW(wezel, nazwa)[0]
}

function dzieckoNs(wezel: Element | null | undefined, ns: string, nazwa: string) {
  if (!wezel) {
    return undefined
  }

  return Array.from(wezel.childNodes).find(
    (dziecko): dziecko is Element => dziecko.nodeType === 1 && (dziecko as Element).localName === nazwa && (dziecko as Element).namespaceURI === ns,
  )
}

function atrW(wezel: Element | null | undefined, nazwa: string) {
  if (!wezel) {
    return null
  }

  return wezel.getAttributeNS(nsW, nazwa) || wezel.getAttribute(`w:${nazwa}`) || null
}

function liczbaAtrW(wezel: Element | null | undefined, nazwa: string) {
  const wartosc = atrW(wezel, nazwa)
  const liczba = wartosc === null ? NaN : Number(wartosc)

  return Number.isFinite(liczba) ? liczba : undefined
}

function przelacznikW(wezel: Element | undefined) {
  if (!wezel) {
    return undefined
  }

  const wartosc = atrW(wezel, 'val')

  return !(wartosc === '0' || wartosc === 'false' || wartosc === 'off' || wartosc === 'none')
}

// ——— właściwości runu i akapitu ———

function czytajRPr(rPr: Element | undefined, kontekst?: Pick<KontekstStylowDocx, 'fontMotywuPodrzedny' | 'fontMotywuGlowny'>): WlasciwosciRunu {
  if (!rPr) {
    return {}
  }

  const wynik: WlasciwosciRunu = {}
  const fonty = dzieckoW(rPr, 'rFonts')

  if (fonty) {
    const kroj = atrW(fonty, 'ascii') || atrW(fonty, 'hAnsi')
    const motyw = atrW(fonty, 'asciiTheme') || atrW(fonty, 'hAnsiTheme')

    if (kroj) {
      wynik.kroj = kroj
    } else if (motyw && kontekst) {
      wynik.kroj = motyw.startsWith('major') ? kontekst.fontMotywuGlowny : kontekst.fontMotywuPodrzedny
    }
  }

  const rozmiar = liczbaAtrW(dzieckoW(rPr, 'sz'), 'val')

  if (rozmiar && rozmiar > 0) {
    wynik.rozmiarPt = rozmiar / 2
  }

  const pogrubienie = przelacznikW(dzieckoW(rPr, 'b'))
  const kursywa = przelacznikW(dzieckoW(rPr, 'i'))
  const podkreslenie = przelacznikW(dzieckoW(rPr, 'u'))
  const kolor = atrW(dzieckoW(rPr, 'color'), 'val')

  if (pogrubienie !== undefined) wynik.pogrubienie = pogrubienie
  if (kursywa !== undefined) wynik.kursywa = kursywa
  if (podkreslenie !== undefined) wynik.podkreslenie = podkreslenie
  if (kolor && kolor !== 'auto') wynik.kolor = `#${kolor.replace('#', '')}`

  return wynik
}

function czytajPPr(pPr: Element | undefined, kontekst?: Pick<KontekstStylowDocx, 'fontMotywuPodrzedny' | 'fontMotywuGlowny'>): WlasciwosciAkapitu {
  if (!pPr) {
    return {}
  }

  const wynik: WlasciwosciAkapitu = {}
  const odstepy = dzieckoW(pPr, 'spacing')

  if (odstepy) {
    const przed = liczbaAtrW(odstepy, 'before')
    const po = liczbaAtrW(odstepy, 'after')
    const linia = liczbaAtrW(odstepy, 'line')
    const regula = atrW(odstepy, 'lineRule')

    if (przed !== undefined) wynik.przedPt = przed / 20
    if (po !== undefined) wynik.poPt = po / 20
    if (linia !== undefined) {
      wynik.liniaWartosc = linia
      wynik.regulaLinii = regula === 'exact' || regula === 'atLeast' ? regula : 'auto'
    }
  }

  const jc = atrW(dzieckoW(pPr, 'jc'), 'val')

  if (jc) {
    wynik.wyrownanie = jc === 'center' ? 'srodek' : jc === 'right' || jc === 'end' ? 'prawo' : jc === 'both' || jc === 'distribute' ? 'wyjustuj' : 'lewo'
  }

  const wciecie = dzieckoW(pPr, 'ind')

  if (wciecie) {
    const lewe = liczbaAtrW(wciecie, 'left') ?? liczbaAtrW(wciecie, 'start')
    const prawe = liczbaAtrW(wciecie, 'right') ?? liczbaAtrW(wciecie, 'end')
    const pierwszy = liczbaAtrW(wciecie, 'firstLine')
    const wiszace = liczbaAtrW(wciecie, 'hanging')

    if (lewe !== undefined) wynik.wciecieLeweMm = lewe * MM_NA_TWIP
    if (prawe !== undefined) wynik.wciecieProweMm = prawe * MM_NA_TWIP
    if (pierwszy !== undefined) wynik.wciecieePierwszegoWierszaMm = pierwszy * MM_NA_TWIP
    if (wiszace !== undefined) wynik.wciecieePierwszegoWierszaMm = -wiszace * MM_NA_TWIP
  }

  const tabulatory = dzieckoW(pPr, 'tabs')

  if (tabulatory) {
    wynik.tabulatoryMm = dzieciW(tabulatory, 'tab')
      .filter((tab) => atrW(tab, 'val') !== 'clear')
      .map((tab) => (liczbaAtrW(tab, 'pos') ?? 0) * MM_NA_TWIP)
      .sort((a, b) => a - b)
  }

  const stylId = atrW(dzieckoW(pPr, 'pStyle'), 'val')

  if (stylId) {
    wynik.stylId = stylId
  }

  const rPrZnaku = dzieckoW(pPr, 'rPr')

  if (rPrZnaku) {
    wynik.rPrZnakuAkapitu = czytajRPr(rPrZnaku, kontekst)
  }

  return wynik
}

function scal<T extends object>(...warstwy: Array<T | undefined>): T {
  const wynik = {} as T

  warstwy.forEach((warstwa) => {
    if (!warstwa) {
      return
    }

    Object.entries(warstwa).forEach(([klucz, wartosc]) => {
      if (wartosc !== undefined) {
        ;(wynik as Record<string, unknown>)[klucz] = wartosc
      }
    })
  })

  return wynik
}

export function utworzKontekstStylowDocx(stylesXml: Document | null, settingsXml: Document | null, themeXml: Document | null): KontekstStylowDocx {
  let fontMotywuPodrzedny = 'Calibri'
  let fontMotywuGlowny = 'Calibri Light'

  if (themeXml) {
    const pobierzKroj = (nazwa: string) => {
      const font = themeXml.getElementsByTagNameNS(nsA, nazwa)[0]
      const latin = font ? Array.from(font.childNodes).find((wezel) => (wezel as Element).localName === 'latin') as Element | undefined : undefined

      return latin?.getAttribute('typeface') || undefined
    }

    fontMotywuPodrzedny = pobierzKroj('minorFont') ?? fontMotywuPodrzedny
    fontMotywuGlowny = pobierzKroj('majorFont') ?? fontMotywuGlowny
  }

  const fonty = { fontMotywuPodrzedny, fontMotywuGlowny }
  const korzen = stylesXml?.documentElement
  const domyslne = dzieckoW(korzen, 'docDefaults')
  const domyslneRunu = scal<WlasciwosciRunu>({ kroj: fontMotywuPodrzedny, rozmiarPt: 10 }, czytajRPr(dzieckoW(dzieckoW(domyslne, 'rPrDefault'), 'rPr'), fonty))
  const domyslneAkapitu = scal<WlasciwosciAkapitu>({ przedPt: 0, poPt: 0, liniaWartosc: 240, regulaLinii: 'auto' }, czytajPPr(dzieckoW(dzieckoW(domyslne, 'pPrDefault'), 'pPr'), fonty))
  const style = new Map<string, StylDocx>()
  let domyslnyStylAkapitu: string | undefined

  dzieciW(korzen, 'style').forEach((styl) => {
    const id = atrW(styl, 'styleId')

    if (!id) {
      return
    }

    const typ = atrW(styl, 'type') ?? 'paragraph'

    if (typ === 'paragraph' && (atrW(styl, 'default') === '1' || atrW(styl, 'default') === 'true')) {
      domyslnyStylAkapitu = id
    }

    style.set(id, {
      id,
      typ,
      bazowy: atrW(dzieckoW(styl, 'basedOn'), 'val') ?? undefined,
      pPr: czytajPPr(dzieckoW(styl, 'pPr'), fonty),
      rPr: czytajRPr(dzieckoW(styl, 'rPr'), fonty),
    })
  })

  const domyslnyTabulator = liczbaAtrW(settingsXml ? dzieckoW(settingsXml.documentElement, 'defaultTabStop') : undefined, 'val') ?? 708

  return {
    domyslneRunu,
    domyslneAkapitu,
    style,
    domyslnyStylAkapitu,
    domyslnyTabulatorMm: domyslnyTabulator * MM_NA_TWIP,
    ...fonty,
  }
}

function lancuchStylu(kontekst: KontekstStylowDocx, stylId: string | undefined) {
  const lancuch: StylDocx[] = []
  const odwiedzone = new Set<string>()
  let biezacy = stylId ? kontekst.style.get(stylId) : undefined

  while (biezacy && !odwiedzone.has(biezacy.id)) {
    odwiedzone.add(biezacy.id)
    lancuch.unshift(biezacy)
    biezacy = biezacy.bazowy ? kontekst.style.get(biezacy.bazowy) : undefined
  }

  return lancuch
}

// ——— geometria strony ———

export function czytajUstawieniaStrony(body: Element): UstawieniaStronyDocx {
  const sectPr = dzieckoW(body, 'sectPr')
  const rozmiar = dzieckoW(sectPr, 'pgSz')
  const marginesy = dzieckoW(sectPr, 'pgMar')
  const mm = (wartosc: number | undefined, domyslna: number) => (wartosc === undefined ? domyslna : wartosc * MM_NA_TWIP)
  let szerokoscMm = mm(liczbaAtrW(rozmiar, 'w'), 210)
  let wysokoscMm = mm(liczbaAtrW(rozmiar, 'h'), 297)

  if (atrW(rozmiar, 'orient') === 'landscape' && szerokoscMm < wysokoscMm) {
    ;[szerokoscMm, wysokoscMm] = [wysokoscMm, szerokoscMm]
  }

  return {
    szerokoscMm: Math.round(szerokoscMm * 10) / 10,
    wysokoscMm: Math.round(wysokoscMm * 10) / 10,
    marginesGornyMm: Math.abs(mm(liczbaAtrW(marginesy, 'top'), 25)),
    marginesDolnyMm: Math.abs(mm(liczbaAtrW(marginesy, 'bottom'), 25)),
    marginesLewyMm: mm(liczbaAtrW(marginesy, 'left'), 25),
    marginesPrawyMm: mm(liczbaAtrW(marginesy, 'right'), 25),
    odlegloscNaglowkaMm: mm(liczbaAtrW(marginesy, 'header'), 12.5),
    odlegloscStopkiMm: mm(liczbaAtrW(marginesy, 'footer'), 12.5),
  }
}

/** Zwraca identyfikator relacji domyślnego nagłówka/stopki sekcji. */
export function pobierzIdRelacjiCzesciSekcji(body: Element, typ: 'header' | 'footer') {
  const sectPr = dzieckoW(body, 'sectPr')
  const odwolania = dzieciW(sectPr, `${typ}Reference`)
  const domyslne = odwolania.find((odwolanie) => atrW(odwolanie, 'type') === 'default') ?? odwolania[0]

  return domyslne ? domyslne.getAttributeNS(nsR, 'id') || domyslne.getAttribute('r:id') : null
}

// ——— metryki czcionek ———

/** Naturalna wysokość wiersza (ascent + descent + lineGap) jako wielokrotność rozmiaru czcionki. */
export function wspolczynnikWysokosciLinii(kroj: string) {
  const nazwa = kroj.toLowerCase()

  if (nazwa.includes('open sans')) return 1.362
  if (nazwa.includes('calibri')) return 1.22
  if (nazwa.includes('cambria')) return 1.172
  if (nazwa.includes('segoe')) return 1.33
  if (nazwa.includes('roboto')) return 1.172
  if (nazwa.includes('lato')) return 1.2
  if (nazwa.includes('verdana') || nazwa.includes('tahoma')) return 1.215
  if (nazwa.includes('arial') || nazwa.includes('helvetica') || nazwa.includes('liberation sans')) return 1.15
  if (nazwa.includes('times') || nazwa.includes('georgia')) return 1.15

  return 1.2
}

function sredniaSzerokoscZnaku(kroj: string) {
  const nazwa = kroj.toLowerCase()

  if (nazwa.includes('condensed') || nazwa.includes('narrow')) return 0.42
  if (nazwa.includes('verdana')) return 0.58

  return 0.5
}

function wysokoscLiniiPt(rozmiarPt: number, kroj: string, akapit: WlasciwosciAkapitu) {
  const naturalna = rozmiarPt * wspolczynnikWysokosciLinii(kroj)
  const linia = akapit.liniaWartosc ?? 240

  if (akapit.regulaLinii === 'exact') {
    return linia / 20
  }

  if (akapit.regulaLinii === 'atLeast') {
    return Math.max(naturalna, linia / 20)
  }

  return naturalna * (linia / 240)
}

// ——— układ ———

type StanUkladu = {
  strona: UstawieniaStronyDocx
  kontekst: KontekstStylowDocx
  rodzajTekstu: ElementTekstowyDokumentu['rodzaj']
  prefiksId: string
  licznik: number
  rolaGrafik: RolaGrafikiDokumentu
  dolnaGranicaMm: number
}

function czyWewnatrzPolaTekstowego(run: Element, akapit: Element) {
  let rodzic = run.parentNode as Element | null

  while (rodzic && rodzic !== akapit) {
    if (rodzic.localName === 'txbxContent' || rodzic.localName === 'drawing' || rodzic.localName === 'pict') {
      return true
    }

    rodzic = rodzic.parentNode as Element | null
  }

  return false
}

function pobierzRunyAkapitu(akapit: Element) {
  return Array.from(akapit.getElementsByTagNameNS(nsW, 'r')).filter((run) => !czyWewnatrzPolaTekstowego(run, akapit))
}

function zbudujWiersze(runy: Element[], wlasciwosciRunu: (run: Element) => FragmentWiersza['wlasciwosci']) {
  const wiersze: WierszAkapitu[] = [{ fragmenty: [] }]
  let przerwaStrony = false

  runy.forEach((run) => {
    const wlasciwosci = wlasciwosciRunu(run)

    dzieciW(run).forEach((wezel) => {
      const nazwa = wezel.localName

      if (nazwa === 't') {
        wiersze[wiersze.length - 1].fragmenty.push({ tekst: wezel.textContent ?? '', wlasciwosci })
      } else if (nazwa === 'tab' || nazwa === 'ptab') {
        wiersze[wiersze.length - 1].fragmenty.push({ tekst: '\t', wlasciwosci })
      } else if (nazwa === 'noBreakHyphen') {
        wiersze[wiersze.length - 1].fragmenty.push({ tekst: '-', wlasciwosci })
      } else if (nazwa === 'br' || nazwa === 'cr') {
        const typ = atrW(wezel, 'type')

        if (typ === 'page') {
          przerwaStrony = true
          return
        }

        // Złamanie wiersza zamyka bieżący wiersz. Nowy wiersz startuje pusty – jeśli nic do niego nie trafi
        // (złamanie na końcu akapitu), Word nadaje mu wysokość znaku akapitu (w:pPr/w:rPr), a nie runu ze złamaniem.
        wiersze[wiersze.length - 1].fragmenty.push({ tekst: '', wlasciwosci })
        wiersze.push({ fragmenty: [] })
      }
    })
  })

  return { wiersze, przerwaStrony }
}

function wysokoscWiersza(wiersz: WierszAkapitu, znakAkapitu: FragmentWiersza['wlasciwosci'], akapit: WlasciwosciAkapitu) {
  // Word liczy wysokość wiersza z największego „widocznego” runu. Runy zawierające wyłącznie tabulator
  // albo złamanie liczą się tylko wtedy, gdy w wierszu nie ma tekstu; pusty akapit ma wysokość znaku akapitu.
  const zTekstem = wiersz.fragmenty.filter((fragment) => fragment.tekst.trim().length > 0)
  const zrodla = zTekstem.length ? zTekstem : wiersz.fragmenty.length ? wiersz.fragmenty : [{ tekst: '', wlasciwosci: znakAkapitu }]

  return Math.max(...zrodla.map((fragment) => wysokoscLiniiPt(fragment.wlasciwosci.rozmiarPt, fragment.wlasciwosci.kroj, akapit)))
}

function pozycjaTabulatora(pozycjaMm: number, tabulatoryMm: number[], domyslnyMm: number) {
  const niestandardowy = tabulatoryMm.find((tab) => tab > pozycjaMm + 0.01)

  if (niestandardowy !== undefined) {
    return niestandardowy
  }

  return (Math.floor(pozycjaMm / domyslnyMm + 0.0001) + 1) * domyslnyMm
}

function utworzId(stan: StanUkladu, rdzen: string) {
  stan.licznik += 1

  return `${stan.prefiksId}${rdzen}-${stan.licznik}`
}

async function ulozGrafikeAkapitu(
  rysunek: Element,
  stan: StanUkladu,
  czesc: CzescUkladuDocx,
  yAkapituMm: number,
  xAkapituMm: number,
  wynik: WynikUkladuCzesci,
): Promise<{ element: ElementObrazuDokumentu; wTekscie: boolean } | null> {
  const kotwica = dzieckoNs(rysunek, nsWp, 'anchor')
  const wTekscie = dzieckoNs(rysunek, nsWp, 'inline')
  const ramka = kotwica ?? wTekscie

  if (!ramka) {
    return null
  }

  const blip = ramka.getElementsByTagNameNS(nsA, 'blip')[0]
  const idRelacji = blip ? blip.getAttributeNS(nsR, 'embed') || blip.getAttribute('r:embed') : null

  if (!idRelacji) {
    wynik.ostrzezenia.push('Pominięto rysunek bez osadzonej grafiki (kształt lub wykres DrawingML).')
    return null
  }

  const grafika = await czesc.pobierzGrafike(idRelacji, stan.rolaGrafik)

  if (!grafika) {
    return null
  }

  const rozmiar = dzieckoNs(ramka, nsWp, 'extent')
  const szerokoscMm = Number(rozmiar?.getAttribute('cx') ?? 0) * MM_NA_EMU
  const wysokoscMm = Number(rozmiar?.getAttribute('cy') ?? 0) * MM_NA_EMU
  const { strona } = stan
  const szerokoscTresci = strona.szerokoscMm - strona.marginesLewyMm - strona.marginesPrawyMm
  let x = xAkapituMm
  let y = yAkapituMm
  let bezwzgledny = false

  if (kotwica) {
    const poziomo = dzieckoNs(kotwica, nsWp, 'positionH')
    const pionowo = dzieckoNs(kotwica, nsWp, 'positionV')
    const odH = poziomo?.getAttribute('relativeFrom') ?? 'column'
    const odV = pionowo?.getAttribute('relativeFrom') ?? 'paragraph'
    const przesuniecieH = dzieckoNs(poziomo, nsWp, 'posOffset')?.textContent
    const wyrownanieH = dzieckoNs(poziomo, nsWp, 'align')?.textContent
    const przesuniecieV = dzieckoNs(pionowo, nsWp, 'posOffset')?.textContent
    const wyrownanieV = dzieckoNs(pionowo, nsWp, 'align')?.textContent
    const [bazaX, zakresX] = odH === 'page'
      ? [0, strona.szerokoscMm]
      : odH === 'leftMargin' || odH === 'insideMargin'
        ? [0, strona.marginesLewyMm]
        : odH === 'rightMargin' || odH === 'outsideMargin'
          ? [strona.szerokoscMm - strona.marginesPrawyMm, strona.marginesPrawyMm]
          : odH === 'character'
            ? [xAkapituMm, szerokoscTresci]
            : [strona.marginesLewyMm, szerokoscTresci]
    const wysokoscTresci = strona.wysokoscMm - strona.marginesGornyMm - strona.marginesDolnyMm
    const [bazaY, zakresY] = odV === 'page'
      ? [0, strona.wysokoscMm]
      : odV === 'margin'
        ? [strona.marginesGornyMm, wysokoscTresci]
        : odV === 'topMargin'
          ? [0, strona.marginesGornyMm]
          : odV === 'bottomMargin'
            ? [strona.wysokoscMm - strona.marginesDolnyMm, strona.marginesDolnyMm]
            : [yAkapituMm, 0]

    if (wyrownanieH) {
      x = wyrownanieH === 'right' || wyrownanieH === 'outside'
        ? bazaX + zakresX - szerokoscMm
        : wyrownanieH === 'center'
          ? bazaX + (zakresX - szerokoscMm) / 2
          : bazaX
    } else {
      x = bazaX + Number(przesuniecieH ?? 0) * MM_NA_EMU
    }

    if (wyrownanieV) {
      y = wyrownanieV === 'bottom' || wyrownanieV === 'outside'
        ? bazaY + zakresY - wysokoscMm
        : wyrownanieV === 'center'
          ? bazaY + (zakresY - wysokoscMm) / 2
          : bazaY
    } else {
      y = bazaY + Number(przesuniecieV ?? 0) * MM_NA_EMU
    }

    bezwzgledny = odV !== 'paragraph' && odV !== 'line'
  }

  const element: ElementObrazuDokumentu = {
    id: utworzId(stan, 'obraz'),
    rodzaj: 'obraz',
    status: 'staly',
    nazwa: grafika.nazwa,
    zrodlo: grafika.zrodlo,
    rola: grafika.rola,
    zasobId: grafika.id,
    pozycja: {
      x: zaokraglij(x),
      y: zaokraglij(y),
      szerokosc: zaokraglij(szerokoscMm || 40),
      wysokosc: zaokraglij(wysokoscMm || 20),
    },
    zIndex: kotwica?.getAttribute('behindDoc') === '1' ? 0 : 2,
  }

  if (bezwzgledny) {
    wynik.elementyBezwzgledne.add(element.id)
  }

  return { element, wTekscie: Boolean(wTekscie) }
}

function zaokraglij(wartosc: number) {
  return Math.round(wartosc * 100) / 100
}

async function ulozAkapit(akapit: Element, y: number, stan: StanUkladu, czesc: CzescUkladuDocx, wynik: WynikUkladuCzesci) {
  const { kontekst, strona } = stan
  const pPrBezposrednie = czytajPPr(dzieckoW(akapit, 'pPr'), kontekst)
  const stylAkapitu = lancuchStylu(kontekst, pPrBezposrednie.stylId ?? kontekst.domyslnyStylAkapitu)
  const pPr = scal<WlasciwosciAkapitu>(kontekst.domyslneAkapitu, ...stylAkapitu.map((styl) => styl.pPr), pPrBezposrednie)
  const rPrAkapitu = scal<WlasciwosciRunu>(kontekst.domyslneRunu, ...stylAkapitu.map((styl) => styl.rPr))
  const pelneWlasciwosci = (warstwa: WlasciwosciRunu | undefined) => scal<WlasciwosciRunu>(rPrAkapitu, warstwa) as FragmentWiersza['wlasciwosci']
  const znakAkapitu = pelneWlasciwosci(pPrBezposrednie.rPrZnakuAkapitu)
  const runy = pobierzRunyAkapitu(akapit)
  const { wiersze, przerwaStrony } = zbudujWiersze(runy, (run) => {
    const rPrRunu = dzieckoW(run, 'rPr')
    const stylZnakowy = lancuchStylu(kontekst, atrW(dzieckoW(rPrRunu, 'rStyle'), 'val') ?? undefined)

    return scal<WlasciwosciRunu>(rPrAkapitu, ...stylZnakowy.map((styl) => styl.rPr), czytajRPr(rPrRunu, kontekst)) as FragmentWiersza['wlasciwosci']
  })
  const elementy: ElementDokumentu[] = []
  const wciecieLewe = pPr.wciecieLeweMm ?? 0
  const wciecieProwe = pPr.wciecieProweMm ?? 0
  const xLewy = strona.marginesLewyMm + wciecieLewe
  const szerokoscDostepna = strona.szerokoscMm - strona.marginesPrawyMm - wciecieProwe - xLewy
  const yStartu = y
  let yBiezace = y + (pPr.przedPt ?? 0) * MM_NA_PT
  const yGornyTresci = yBiezace

  // Grafiki osadzone w akapicie
  const grafikiWTekscie: ElementObrazuDokumentu[] = []

  for (const rysunek of Array.from(akapit.getElementsByTagNameNS(nsW, 'drawing'))) {
    const ulozona = await ulozGrafikeAkapitu(rysunek, stan, czesc, yGornyTresci, xLewy, wynik)

    if (!ulozona) {
      continue
    }

    if (ulozona.wTekscie) {
      grafikiWTekscie.push(ulozona.element)
    } else {
      elementy.push(ulozona.element)
    }
  }

  if (akapit.getElementsByTagNameNS(nsW, 'pict').length || akapit.getElementsByTagName('w:object').length) {
    wynik.ostrzezenia.push('Akapit zawiera obiekt VML/OLE – jego położenie wymaga ręcznej kontroli.')
  }

  // Tekst
  const teksty = wiersze.map((wiersz) => wiersz.fragmenty.map((fragment) => fragment.tekst).join(''))
  const pierwszyWiersz = teksty[0] ?? ''
  const liczbaWiodacychTabulatorow = pierwszyWiersz.match(/^\t*/)?.[0].length ?? 0
  let xTekstu = xLewy + (pPr.wciecieePierwszegoWierszaMm ?? 0)

  for (let indeks = 0; indeks < liczbaWiodacychTabulatorow; indeks++) {
    xTekstu = strona.marginesLewyMm + pozycjaTabulatora(xTekstu - strona.marginesLewyMm, pPr.tabulatoryMm ?? [], kontekst.domyslnyTabulatorMm)
  }

  const trescWierszy = teksty.map((tekst, indeks) => (indeks === 0 ? tekst.slice(liczbaWiodacychTabulatorow) : tekst.replace(/^\t+/, '')).replace(/\t/g, '    ').replace(/\s+$/, ''))
  const czyJestTekst = trescWierszy.some((tekst) => tekst.trim().length > 0)
  const szerokoscTekstu = Math.max(10, strona.szerokoscMm - strona.marginesPrawyMm - wciecieProwe - xTekstu)
  let wysokoscTekstuMm = 0
  let pierwszaWysokoscLiniiMm = 0

  wiersze.forEach((wiersz, indeks) => {
    const liniaMm = wysokoscWiersza(wiersz, znakAkapitu, pPr) * MM_NA_PT
    const tekstWiersza = trescWierszy[indeks] ?? ''
    const fragmentGlowny = wiersz.fragmenty.find((fragment) => fragment.tekst.trim()) ?? wiersz.fragmenty[0]
    const rozmiar = fragmentGlowny?.wlasciwosci.rozmiarPt ?? znakAkapitu.rozmiarPt
    const kroj = fragmentGlowny?.wlasciwosci.kroj ?? znakAkapitu.kroj
    const szerokoscTekstuMm = tekstWiersza.length * rozmiar * sredniaSzerokoscZnaku(kroj) * MM_NA_PT
    const liczbaLinii = Math.max(1, Math.ceil(szerokoscTekstuMm / (indeks === 0 ? szerokoscTekstu : szerokoscDostepna)))

    if (indeks === 0) {
      pierwszaWysokoscLiniiMm = liniaMm
    }

    wysokoscTekstuMm += liniaMm * liczbaLinii
  })

  const wysokoscGrafikWTekscie = grafikiWTekscie.reduce((suma, grafika) => suma + grafika.pozycja.wysokosc, 0)

  grafikiWTekscie.forEach((grafika, indeks) => {
    const przesuniecie = grafikiWTekscie.slice(0, indeks).reduce((suma, poprzednia) => suma + poprzednia.pozycja.wysokosc, 0)
    const xGrafiki = pPr.wyrownanie === 'srodek'
      ? xLewy + (szerokoscDostepna - grafika.pozycja.szerokosc) / 2
      : pPr.wyrownanie === 'prawo'
        ? xLewy + szerokoscDostepna - grafika.pozycja.szerokosc
        : xTekstu

    grafika.pozycja.x = zaokraglij(xGrafiki)
    grafika.pozycja.y = zaokraglij(yBiezace + przesuniecie)
    elementy.push(grafika)
  })

  yBiezace += wysokoscGrafikWTekscie

  if (czyJestTekst) {
    const fragmentGlowny = wiersze.flatMap((wiersz) => wiersz.fragmenty).find((fragment) => fragment.tekst.trim())
    const wlasciwosci = fragmentGlowny?.wlasciwosci ?? znakAkapitu
    const tekst = trescWierszy.join('\n').replace(/\n+$/, '')
    const element: ElementTekstowyDokumentu = {
      id: utworzId(stan, 'tekst'),
      rodzaj: stan.rodzajTekstu,
      status: 'staly',
      tekst,
      pozycja: {
        x: zaokraglij(xTekstu),
        y: zaokraglij(yBiezace),
        szerokosc: zaokraglij(szerokoscTekstu),
        wysokosc: zaokraglij(wysokoscTekstuMm),
      },
      styl: {
        krojCzcionki: wlasciwosci.kroj,
        rozmiarCzcionki: wlasciwosci.rozmiarPt,
        pogrubienie: Boolean(wlasciwosci.pogrubienie),
        kursywa: Boolean(wlasciwosci.kursywa),
        podkreslenie: Boolean(wlasciwosci.podkreslenie),
        kolor: wlasciwosci.kolor ?? '#000000',
        wyrownanie: pPr.wyrownanie ?? 'lewo',
        wysokoscLiniiMm: zaokraglij(pierwszaWysokoscLiniiMm),
      },
      zIndex: 4,
    }

    elementy.push(element)
  }

  yBiezace += wysokoscTekstuMm
  yBiezace += (pPr.poPt ?? 0) * MM_NA_PT

  return {
    elementy,
    y: yBiezace,
    wysokosc: yBiezace - yStartu,
    przerwaStrony,
  }
}

export type OpcjeUkladuCzesci = {
  strona: UstawieniaStronyDocx
  kontekst: KontekstStylowDocx
  rodzajTekstu: ElementTekstowyDokumentu['rodzaj']
  prefiksId: string
  rolaGrafik: RolaGrafikiDokumentu
  yStartu: number
  /** Gdy podane – akapity wychodzące poza tę granicę trafiają na kolejną stronę. */
  dolnaGranicaMm?: number
  utworzTabele?: (tabela: Element, y: number, x: number, szerokosc: number) => ElementDokumentu & { pozycja: { wysokosc: number } }
}

/**
 * Układa treść jednej części DOCX (body, nagłówek albo stopka).
 * Zwraca elementy pogrupowane na strony (dla nagłówka/stopki zawsze jedna strona).
 */
export async function ulozCzescDocx(czesc: CzescUkladuDocx, opcje: OpcjeUkladuCzesci): Promise<{ strony: WynikUkladuCzesci[] }> {
  const stan: StanUkladu = {
    strona: opcje.strona,
    kontekst: opcje.kontekst,
    rodzajTekstu: opcje.rodzajTekstu,
    prefiksId: opcje.prefiksId,
    licznik: 0,
    rolaGrafik: opcje.rolaGrafik,
    dolnaGranicaMm: opcje.dolnaGranicaMm ?? Number.POSITIVE_INFINITY,
  }
  const nowaStrona = (): WynikUkladuCzesci => ({ elementy: [], y: opcje.yStartu, elementyBezwzgledne: new Set(), przerwyStron: [], ostrzezenia: [] })
  const strony: WynikUkladuCzesci[] = [nowaStrona()]
  const biezaca = () => strony[strony.length - 1]

  for (const dziecko of dzieciW(czesc.wezelTresci)) {
    if (dziecko.localName === 'p') {
      const wynik = biezaca()
      let ulozony = await ulozAkapit(dziecko, wynik.y, stan, czesc, wynik)

      if (ulozony.y > stan.dolnaGranicaMm && wynik.y > opcje.yStartu + 0.1) {
        strony.push(nowaStrona())
        ulozony = await ulozAkapit(dziecko, biezaca().y, stan, czesc, biezaca())
      }

      biezaca().elementy.push(...ulozony.elementy)
      biezaca().y = ulozony.y

      if (ulozony.przerwaStrony) {
        strony.push(nowaStrona())
      }
    } else if (dziecko.localName === 'tbl' && opcje.utworzTabele) {
      const x = opcje.strona.marginesLewyMm
      const szerokosc = opcje.strona.szerokoscMm - opcje.strona.marginesLewyMm - opcje.strona.marginesPrawyMm
      let tabela = opcje.utworzTabele(dziecko, biezaca().y, x, szerokosc)

      if (biezaca().y + tabela.pozycja.wysokosc > stan.dolnaGranicaMm && biezaca().y > opcje.yStartu + 0.1) {
        strony.push(nowaStrona())
        tabela = opcje.utworzTabele(dziecko, biezaca().y, x, szerokosc)
      }

      biezaca().elementy.push(tabela)
      biezaca().y += tabela.pozycja.wysokosc
    } else if (dziecko.localName === 'sdt') {
      const tresc = dzieckoW(dziecko, 'sdtContent')

      if (tresc) {
        const zagniezdzone = await ulozCzescDocx({ ...czesc, wezelTresci: tresc }, { ...opcje, yStartu: biezaca().y, prefiksId: `${opcje.prefiksId}sdt${stan.licznik++}-` })
        const [pierwsza, ...kolejne] = zagniezdzone.strony

        biezaca().elementy.push(...pierwsza.elementy)
        biezaca().y = pierwsza.y
        pierwsza.elementyBezwzgledne.forEach((id) => biezaca().elementyBezwzgledne.add(id))
        strony.push(...kolejne)
      }
    }
  }

  return { strony }
}

/** Przesuwa elementy stopki tak, by jej dół wypadał w odległości `odlegloscStopkiMm` od dołu strony. */
export function zakotwiczStopke(wynik: WynikUkladuCzesci, strona: UstawieniaStronyDocx, yStartu: number) {
  const wysokoscTresci = wynik.y - yStartu
  const przesuniecie = strona.wysokoscMm - strona.odlegloscStopkiMm - wysokoscTresci - yStartu

  return wynik.elementy.map((element) => {
    if (wynik.elementyBezwzgledne.has(element.id) || !('pozycja' in element)) {
      return element
    }

    return {
      ...element,
      pozycja: {
        ...element.pozycja,
        y: zaokraglij(element.pozycja.y + przesuniecie),
      },
    } as ElementDokumentu
  })
}

export function utworzStroneUkladu(numer: number, ustawienia: UstawieniaStronyDocx, elementy: ElementDokumentu[]): StronaDokumentu {
  return {
    id: `strona-${numer}`,
    numer,
    format: 'A4',
    jednostka: 'mm',
    szerokoscMm: ustawienia.szerokoscMm,
    wysokoscMm: ustawienia.wysokoscMm,
    elementy,
  }
}
