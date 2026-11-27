import { MM_NA_PT, szacujSzerokoscTekstuMm, wspolczynnikWysokosciLinii } from '../../../wspolne/import/ukladDocx'
import type {
  DokumentPomagiera,
  ElementDokumentu,
  ElementTekstowyDokumentu,
  PoleDynamiczneDokumentu,
} from '../../../wspolne/dokumenty/typyDokumentu'
import type { PlaceholderReplikatora, TrybPodstawieniaPlaceholdera } from './typyReplikatora'

/** Dane potrzebne do wypełnienia szablonu; zgodne strukturalnie z `DaneSeryjnychDyplomow` i kontekstem Szczegółów. */
export type DaneDoWypelnieniaSzablonu = {
  tytulSzkolenia?: string
  liczbaGodzin?: string | number | null
  trener?: string
  miejsceSzkolenia?: string
  daty?: string[]
  organizator?: string
  klient?: string
}

const wzorzecPlaceholdera = /\{\{\s*([a-z0-9_.-]+)\s*\}\}/gi
const odstepMiedzyElementamiMm = 1

function pobierzElementy(elementy: ElementDokumentu[]): ElementDokumentu[] {
  return elementy.flatMap((element) => (element.rodzaj === 'blok' ? [element, ...pobierzElementy(element.elementy)] : [element]))
}

function czyElementTekstowy(element: ElementDokumentu): element is ElementTekstowyDokumentu {
  return element.rodzaj === 'tekst' || element.rodzaj === 'naglowek' || element.rodzaj === 'stopka'
}

function przeksztalcElementy(elementy: ElementDokumentu[], przeksztalc: (element: ElementDokumentu) => ElementDokumentu): ElementDokumentu[] {
  return elementy.map((element) => (element.rodzaj === 'blok' ? { ...element, elementy: przeksztalcElementy(element.elementy, przeksztalc) } : przeksztalc(element)))
}

export function pobierzIdElementuZPlaceholdera(placeholder: Pick<PlaceholderReplikatora, 'blokId'>) {
  return placeholder.blokId?.replace(/^blok-/, '') ?? null
}

/** Etykieta z wartością („Data szkolenia: 12.05.2026”) zachowuje etykietę; sama nazwa pola jest zastępowana w całości. */
export function wybierzTrybPodstawienia(tekstElementu: string): TrybPodstawieniaPlaceholdera {
  return /^[^:\n]{2,60}:/.test(tekstElementu.trim()) ? 'etykieta_i_wartosc' : 'zastap_calosc'
}

export function podstawPlaceholderWTekscie(tekst: string, nazwa: string, tryb: TrybPodstawieniaPlaceholdera = wybierzTrybPodstawienia(tekst)) {
  const znacznik = `{{${nazwa}}}`

  if (tryb === 'zastap_calosc') {
    return znacznik
  }

  const indeksDwukropka = tekst.indexOf(':')

  return indeksDwukropka < 0 ? znacznik : `${tekst.slice(0, indeksDwukropka + 1).trimEnd()} ${znacznik}`
}

/**
 * Zatwierdzone placeholdery zastępują treść powiązanych elementów (pozycja i styl bez zmian).
 * Element dostaje status „dynamiczny”, a dokument odpowiadające mu pole dynamiczne.
 * Gdy do jednego elementu przypisano kilka zatwierdzonych placeholderów, stosowany jest pierwszy.
 */
export function zastosujPlaceholderyWDokumencie(dokument: DokumentPomagiera, placeholdery: PlaceholderReplikatora[]): DokumentPomagiera {
  const poElemencie = new Map<string, PlaceholderReplikatora>()

  placeholdery
    .filter((placeholder) => placeholder.status === 'zatwierdzony')
    .forEach((placeholder) => {
      const elementId = pobierzIdElementuZPlaceholdera(placeholder)

      if (elementId && !poElemencie.has(elementId)) {
        poElemencie.set(elementId, placeholder)
      }
    })

  const zastosowane: PoleDynamiczneDokumentu[] = []
  const strony = dokument.strony.map((strona) => ({
    ...strona,
    elementy: przeksztalcElementy(strona.elementy, (element) => {
      const placeholder = poElemencie.get(element.id)

      if (!placeholder || !czyElementTekstowy(element)) {
        return element
      }

      zastosowane.push({
        id: placeholder.id,
        nazwa: placeholder.nazwa,
        etykieta: placeholder.etykieta,
        elementId: element.id,
        status: 'zatwierdzone',
        wartoscPrzykladowa: element.tekst,
        wartoscZrodlowa: placeholder.wartoscZrodlowa,
        pozycja: element.pozycja,
      })

      return {
        ...element,
        status: 'dynamiczny',
        poleDynamiczneId: placeholder.id,
        tekst: podstawPlaceholderWTekscie(element.tekst, placeholder.nazwa, placeholder.tryb ?? wybierzTrybPodstawienia(element.tekst)),
      }
    }),
  }))
  const idZastosowanych = new Set(zastosowane.map((pole) => pole.id))

  return {
    ...dokument,
    strony,
    polaDynamiczne: [...dokument.polaDynamiczne.filter((pole) => !idZastosowanych.has(pole.id) && !poElemencie.has(pole.elementId)), ...zastosowane],
  }
}

export function formatujDatyDlaSzablonu(daty: string[] | undefined) {
  const poprawne = (daty ?? []).filter((data) => /^\d{4}-\d{2}-\d{2}$/.test(data)).sort()

  if (!poprawne.length) return ''

  const rozbite = poprawne.map((data) => data.split('-'))
  const [rok, miesiac] = rozbite[0]
  const wTymSamymMiesiacu = rozbite.every((czesci) => czesci[0] === rok && czesci[1] === miesiac)

  if (poprawne.length === 1) return `${rozbite[0][2]}.${miesiac}.${rok}`
  if (wTymSamymMiesiacu) return `${rozbite.map((czesci) => czesci[2]).join(', ')}.${miesiac}.${rok}`

  return rozbite.map((czesci) => `${czesci[2]}.${czesci[1]}.${czesci[0]}`).join(', ')
}

/** Mapa nazwa placeholdera → wartość dla jednego dokumentu (np. jednego uczestnika). */
export function zbudujWartosciPlaceholderow(dane: DaneDoWypelnieniaSzablonu, uczestnik?: string): Record<string, string> {
  const liczbaGodzin = dane.liczbaGodzin === null || dane.liczbaGodzin === undefined ? '' : String(dane.liczbaGodzin)

  return {
    'szkolenie.tytul': dane.tytulSzkolenia ?? '',
    'szkolenie.data': formatujDatyDlaSzablonu(dane.daty),
    'szkolenie.liczba_godzin': liczbaGodzin ? `${liczbaGodzin} godz.` : '',
    'szkolenie.trener': dane.trener ?? '',
    'szkolenie.miejsce': dane.miejsceSzkolenia ?? '',
    'szkolenie.organizator': dane.organizator ?? '',
    'szkolenie.klient': dane.klient ?? '',
    'uczestnik.imie_nazwisko': uczestnik ?? '',
  }
}

function zlozTekst(tekst: string, wartosci: Record<string, string>) {
  return tekst.replace(wzorzecPlaceholdera, (_dopasowanie, nazwa: string) => wartosci[nazwa] ?? '')
}

function wysokoscLiniiMm(element: ElementTekstowyDokumentu) {
  return element.styl.wysokoscLiniiMm ?? element.styl.rozmiarCzcionki * wspolczynnikWysokosciLinii(element.styl.krojCzcionki) * MM_NA_PT
}

/** Liczba wierszy po zawinięciu tekstu w polu o danej szerokości (słowa niepodzielne, twarde łamania respektowane). */
export function policzWierszeTekstu(element: ElementTekstowyDokumentu, tekst: string) {
  const { krojCzcionki, rozmiarCzcionki, pogrubienie } = element.styl
  const szerokoscPola = Math.max(1, element.pozycja.szerokosc)
  const mierz = (fragment: string) => szacujSzerokoscTekstuMm(fragment, krojCzcionki, rozmiarCzcionki, pogrubienie)

  return tekst.split('\n').reduce((suma, akapit) => {
    let wiersze = 1
    let biezacy = ''

    akapit.split(/\s+/).filter(Boolean).forEach((slowo) => {
      const kandydat = biezacy ? `${biezacy} ${slowo}` : slowo

      if (biezacy && mierz(kandydat) > szerokoscPola) {
        wiersze += 1
        biezacy = slowo
      } else {
        biezacy = kandydat
      }

      if (mierz(biezacy) > szerokoscPola) {
        // Pojedyncze słowo szersze niż pole łamie się twardo.
        const dodatkowe = Math.floor(mierz(biezacy) / szerokoscPola)

        wiersze += dodatkowe
        biezacy = ''
      }
    })

    return suma + wiersze
  }, 0)
}

function czyNakladajaSieWPoziomie(a: ElementDokumentu, b: ElementDokumentu) {
  return a.pozycja.x < b.pozycja.x + b.pozycja.szerokosc - 0.01 && b.pozycja.x < a.pozycja.x + a.pozycja.szerokosc - 0.01
}

/**
 * Wypełnia szablon wartościami. Teksty zawijają się w obrębie swojego pola; element rośnie w dół o liczbę
 * dodatkowych wierszy, a kolejne teksty tej samej kolumny przesuwają się tylko wtedy, gdy urosły element
 * realnie na nie nachodzi (z zachowaniem pierwotnego odstępu).
 */
export function wypelnijDokumentSzablonu(dokument: DokumentPomagiera, wartosci: Record<string, string>): DokumentPomagiera {
  const strony = dokument.strony.map((strona) => {
    const wypelnione = new Map<string, ElementTekstowyDokumentu>()
    const oryginaly = new Map<string, ElementTekstowyDokumentu>()

    pobierzElementy(strona.elementy).forEach((element) => {
      if (!czyElementTekstowy(element) || !new RegExp(wzorzecPlaceholdera.source, 'i').test(element.tekst)) {
        return
      }

      const tekst = zlozTekst(element.tekst, wartosci)
      const dodatkoweWiersze = Math.max(0, policzWierszeTekstu(element, tekst) - policzWierszeTekstu(element, element.tekst))

      oryginaly.set(element.id, element)
      wypelnione.set(element.id, {
        ...element,
        tekst,
        status: 'staly',
        poleDynamiczneId: undefined,
        pozycja: { ...element.pozycja, wysokosc: element.pozycja.wysokosc + dodatkoweWiersze * wysokoscLiniiMm(element) },
      })
    })

    const elementyPoWypelnieniu = przeksztalcElementy(strona.elementy, (element) => wypelnione.get(element.id) ?? element)
    const przesuniecia = new Map<string, number>()
    const urosly = [...wypelnione.values()].some((element) => element.pozycja.wysokosc > (oryginaly.get(element.id)?.pozycja.wysokosc ?? 0) + 0.01)

    if (urosly) {
      // Teksty od góry do dołu; element przesuwa się o tyle, o ile wyższy element nad nim realnie na niego nachodzi.
      const teksty = pobierzElementy(elementyPoWypelnieniu)
        .filter((element): element is ElementTekstowyDokumentu => element.rodzaj === 'tekst')
        .sort((a, b) => a.pozycja.y - b.pozycja.y)
      const nowaGora = new Map<string, number>()
      const nowyDol = new Map<string, number>()

      teksty.forEach((element) => {
        const staraGora = element.pozycja.y
        let nowaGoraElementu = staraGora

        teksty.forEach((nad) => {
          const staryDolNad = (oryginaly.get(nad.id)?.pozycja.y ?? nad.pozycja.y) + (oryginaly.get(nad.id)?.pozycja.wysokosc ?? nad.pozycja.wysokosc)
          const czyNad = nad.id !== element.id && nad.pozycja.y < staraGora && czyNakladajaSieWPoziomie(nad, element)
          const dolNad = nowyDol.get(nad.id)

          const czyZmienionyWPionie = przesuniecia.has(nad.id) || nad.pozycja.wysokosc > (oryginaly.get(nad.id)?.pozycja.wysokosc ?? Infinity) + 0.01

          if (!czyNad || !czyZmienionyWPionie || dolNad === undefined || dolNad <= staraGora + 0.01) {
            return
          }

          const odstepPierwotny = Math.max(0, staraGora - staryDolNad)

          nowaGoraElementu = Math.max(nowaGoraElementu, dolNad + Math.min(odstepPierwotny, odstepMiedzyElementamiMm * 5))
        })

        nowaGora.set(element.id, nowaGoraElementu)
        nowyDol.set(element.id, nowaGoraElementu + element.pozycja.wysokosc)

        if (nowaGoraElementu - staraGora > 0.01) przesuniecia.set(element.id, nowaGoraElementu - staraGora)
      })
    }

    return {
      ...strona,
      elementy: przeksztalcElementy(elementyPoWypelnieniu, (element) => {
        const przesuniecie = przesuniecia.get(element.id)

        return przesuniecie ? { ...element, pozycja: { ...element.pozycja, y: element.pozycja.y + przesuniecie } } : element
      }),
    }
  })

  return { ...dokument, strony, polaDynamiczne: [] }
}

/** Jeden wypełniony dokument na uczestnika (certyfikaty seryjne). Bez uczestników – jeden dokument z pustym polem osoby. */
export function wygenerujDokumentyZSzablonu(dokument: DokumentPomagiera, dane: DaneDoWypelnieniaSzablonu, uczestnicy: string[]) {
  const lista = uczestnicy.length ? uczestnicy : ['']

  return lista.map((uczestnik) => ({
    uczestnik,
    dokument: { ...wypelnijDokumentSzablonu(dokument, zbudujWartosciPlaceholderow(dane, uczestnik)), id: `${dokument.id}-${uczestnik ? uczestnik.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-') : 'wzor'}` },
  }))
}

export function odmienLiczbeStron(liczba: number) {
  const koncowka = liczba % 10
  const dziesiatki = liczba % 100

  if (liczba === 1) return '1 strona'
  if (koncowka >= 2 && koncowka <= 4 && !(dziesiatki >= 12 && dziesiatki <= 14)) return `${liczba} strony`

  return `${liczba} stron`
}
