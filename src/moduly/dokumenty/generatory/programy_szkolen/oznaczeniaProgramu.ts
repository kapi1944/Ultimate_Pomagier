export const styleOznaczenProgramu = [
  ['oryginalne', 'Oryginalne'], ['brak', 'Bez oznaczenia'],
  ['•', '•'], ['◦', '◦'], ['▪', '▪'], ['-', '–'],
  ['arabskie.', '1. 2. 3.'], ['arabskie)', '1) 2) 3)'],
  ['rzymskie.', 'I. II. III.'], ['rzymskie)', 'I) II) III)'],
  ['literowe.', 'a. b. c.'], ['literowe)', 'a) b) c)'],
] as const

export type OznaczenieProgramu = { zapis: string; wartosc?: number; rodzaj: 'arabskie' | 'rzymskie' | 'literowe' | 'punktor' }
export type UstawienieWierszaProgramu = { styl?: string; poziom?: number; wciecieMm?: number; kategoriaWciecia?: string }

export const kategorieWciecProgramu = ['1', '2', '3', '4', 'punktory']
export const maksymalneWciecieProgramuMm = 50

export function normalizujWciecieProgramu(wartosc: unknown) {
  return typeof wartosc === 'number' && Number.isFinite(wartosc)
    ? Math.min(maksymalneWciecieProgramuMm, Math.max(0, wartosc))
    : undefined
}

export function rozpoznajKategorieWcieciaProgramu(tekst: string, glebokoscListy?: number) {
  const oznaczenie = rozpoznajOznaczenieProgramu(tekst)?.oznaczenie
  if (oznaczenie?.rodzaj === 'punktor') return 'punktory'
  if (glebokoscListy !== undefined) return String(Math.min(4, glebokoscListy + 1))
  if (oznaczenie?.rodzaj === 'arabskie') return String(Math.min(4, oznaczenie.zapis.replace(/[.)]$/, '').split('.').length))
}

export function normalizujWierszWejsciowy(wiersz: string): string {
  const wzorzecBrzegu = /^[\s\uFEFF\u200B-\u200F\u2060\u00AD\u202A-\u202E\u2066-\u2069]+|[\s\uFEFF\u200B-\u200F\u2060\u00AD\u202A-\u202E\u2066-\u2069]+$/gu
  return wiersz.replace(wzorzecBrzegu, (brzeg, indeks: number) => indeks === 0
    ? brzeg.replace(/[^ \t]/g, '')
    : '')
}

/**
 * Jednoliterowe oznaczenia I, V, X, L, C, D, M są dwuznaczne: mogą być cyfrą rzymską albo kolejną literą listy (A. B. C. D.).
 * Rozstrzygamy to po sekwencji: litera kontynuująca poprzednią literę lub poprzedzająca literę-następcę jest literą listy.
 */
export function wyznaczLiterowoscOznaczen(tresci: string[]): boolean[] {
  const jednoliterowe = (tresc: string) => {
    const zapis = rozpoznajOznaczenieProgramu(tresc)?.oznaczenie.zapis
    return zapis && /^[a-z][.)]$/i.test(zapis) ? zapis.toLowerCase().charCodeAt(0) - 96 : undefined
  }
  let ostatniaLitera: number | undefined
  let ostatniRzymski: number | undefined
  return tresci.map((tresc, indeks) => {
    const oznaczenie = rozpoznajOznaczenieProgramu(tresc)?.oznaczenie
    if (!oznaczenie) return false
    const litera = jednoliterowe(tresc)
    if (litera === undefined) {
      if (oznaczenie.rodzaj === 'arabskie') { ostatniaLitera = undefined; ostatniRzymski = undefined }
      if (oznaczenie.rodzaj === 'rzymskie') { ostatniRzymski = oznaczenie.wartosc; ostatniaLitera = undefined }
      return false
    }
    let czyLitera = oznaczenie.rodzaj !== 'rzymskie'
    if (!czyLitera) {
      const nastepnaLitera = tresci.slice(indeks + 1).map(jednoliterowe).find((wartosc) => wartosc !== undefined)
      czyLitera = ostatniaLitera !== undefined && litera === ostatniaLitera + 1
        ? true
        : ostatniRzymski !== undefined && oznaczenie.wartosc === ostatniRzymski + 1
          ? false
          : nastepnaLitera === litera + 1
    }
    if (czyLitera) ostatniaLitera = litera
    else { ostatniRzymski = oznaczenie.wartosc; ostatniaLitera = undefined }
    return czyLitera
  })
}

export function wyznaczPoziomyProgramu(wiersze: { tresc: string; poziom: number; jawnyPoziom?: number }[]) {
  const czyLitery = wyznaczLiterowoscOznaczen(wiersze.map((wiersz) => wiersz.tresc))
  const oznaczenia = wiersze.map((wiersz, indeks) => rozpoznajOznaczenieProgramu(wiersz.tresc, czyLitery[indeks])?.oznaczenie)
  let poziomPoprzedni = 0
  let czyNaglowek = false
  let poziomPunktuNumerowanego: number | undefined
  return wiersze.map((wiersz, indeks) => {
    const oznaczenie = oznaczenia[indeks]
    const czyTytulPrzedListaLiterowa = !oznaczenie && wiersz.jawnyPoziom === undefined && wiersz.poziom === 0
      && oznaczenia[indeks + 1]?.rodzaj === 'literowe' && oznaczenia[indeks + 1]?.wartosc === 1
    let poziom = wiersz.jawnyPoziom
    if (poziom === undefined) {
      poziom = czyTytulPrzedListaLiterowa
        ? poziomPunktuNumerowanego ?? 0
        : oznaczenie ? wiersz.poziom : czyNaglowek ? poziomPoprzedni + 1 : poziomPoprzedni
      poziom = Math.max(poziom, wiersz.poziom)
      if ((oznaczenie?.rodzaj === 'literowe' || oznaczenie?.rodzaj === 'punktor') && poziomPunktuNumerowanego !== undefined) {
        poziom = Math.max(poziom, poziomPunktuNumerowanego + 1)
      }
    }
    czyNaglowek = oznaczenie?.rodzaj === 'rzymskie' || oznaczenie?.rodzaj === 'arabskie' || czyTytulPrzedListaLiterowa
    if (czyNaglowek) poziomPunktuNumerowanego = poziom
    poziomPoprzedni = poziom
    return poziom
  })
}

export function czyStylOznaczeniaPoprawny(styl: unknown): styl is string {
  return typeof styl === 'string' && (styleOznaczenProgramu.some(([wartosc]) => wartosc === styl) || ['–', '*'].includes(styl))
}

export function liczbaRzymska(liczba: number): string {
  if (liczba < 1 || liczba > 3999) return String(liczba)
  let wynik = ''
  for (const [wartosc, zapis] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as const) {
    while (liczba >= wartosc) { wynik += zapis; liczba -= wartosc }
  }
  return wynik
}

export function rozpoznajOznaczenieProgramu(tekst: string, czyLitera = false): { oznaczenie: OznaczenieProgramu; tresc: string } | null {
  if (/^\s*(?:\d{1,2}\.(?:00|[0-5]\d)(?:\s*(?:[-–—]|godz\b)|\s*$)|\d{1,2}\.\d{1,2}\.\d{4}\b|\d+(?:\.\d+)*[.)]?\s+(?:min(?:ut\w*)?|godz\w*|h|s|zł|kg|%)(?=\s|[.,;:]|$))/iu.test(tekst)) return null
  const dopasowanie = tekst.match(/^(\s*)(\d+(?:\.\d+)+(?:[.)])?|\d+[.)]|[IVXLCDMivxlcdm]+[.)]|[a-zA-Z][.)]|[•◦▪·*–—-])\s+(.+)$/)
  if (!dopasowanie) return null
  const zapis = dopasowanie[2]
  const rdzen = zapis.slice(0, -1)
  let rodzaj: OznaczenieProgramu['rodzaj'] = 'punktor'
  let wartosc: number | undefined
  if (/^\d/.test(zapis)) { rodzaj = 'arabskie'; wartosc = zapis.replace(/[.)]$/, '').includes('.') ? undefined : Number(rdzen) }
  else if (/^[IVXLCDM]+$/.test(rdzen) || (rdzen.length > 1 && /^[ivxlcdm]+$/.test(rdzen))) {
    const wartosci: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
    const cyfry = [...rdzen.toUpperCase()].map((cyfra) => wartosci[cyfra])
    const liczba = cyfry.reduce((suma, cyfra, indeks) => suma + (cyfra < (cyfry[indeks + 1] ?? 0) ? -cyfra : cyfra), 0)
    if (liczbaRzymska(liczba) === rdzen.toUpperCase()) { rodzaj = 'rzymskie'; wartosc = liczba }
  }
  if (czyLitera && /^[a-z][.)]$/i.test(zapis)) rodzaj = 'punktor'
  if (rodzaj === 'punktor' && /^[a-z][.)]$/i.test(zapis)) { rodzaj = 'literowe'; wartosc = rdzen.toLowerCase().charCodeAt(0) - 96 }
  return { oznaczenie: { zapis, rodzaj, wartosc }, tresc: dopasowanie[3] }
}

export function formatujOznaczenieProgramu(styl: string, liczba: number): string {
  if (styl === 'brak') return ''
  const zakonczenie = styl.endsWith(')') ? ')' : '.'
  if (styl.startsWith('arabskie')) return `${liczba}${zakonczenie}`
  if (styl.startsWith('rzymskie')) return `${liczbaRzymska(liczba)}${zakonczenie}`
  if (styl.startsWith('literowe')) {
    let wynik = ''
    while (liczba > 0) { liczba -= 1; wynik = String.fromCharCode(97 + liczba % 26) + wynik; liczba = Math.floor(liczba / 26) }
    return `${wynik}${zakonczenie}`
  }
  return styl
}

export function wyznaczOznaczeniaProgramu(pozycje: { poziom: number; oryginalne?: string; styl?: string; wartosc?: number; domyslnyStyl?: string }[], stylePoziomow: string[], domyslnyStyl: string | string[]) {
  const liczniki: number[] = []
  return pozycje.map((pozycja) => {
    const poziom = Math.max(0, pozycja.poziom)
    const styl = pozycja.styl ?? stylePoziomow[poziom] ?? 'oryginalne'
    const czyOryginalne = styl === 'oryginalne'
    liczniki[poziom] = czyOryginalne && pozycja.wartosc !== undefined ? pozycja.wartosc : (liczniki[poziom] ?? 0) + 1
    liczniki.length = poziom + 1
    if (czyOryginalne && pozycja.oryginalne) return pozycja.oryginalne
    const stylDomyslny = pozycja.domyslnyStyl ?? (Array.isArray(domyslnyStyl) ? domyslnyStyl[poziom] ?? domyslnyStyl.at(-1) ?? '•' : domyslnyStyl)
    return formatujOznaczenieProgramu(czyOryginalne ? stylDomyslny : styl, liczniki[poziom])
  })
}
