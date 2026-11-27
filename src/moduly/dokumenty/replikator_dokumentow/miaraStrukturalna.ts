import type { DokumentPomagiera, ElementDokumentu, ElementTekstowyDokumentu } from '../../../wspolne/dokumenty/typyDokumentu'

export type KolizjaElementow = {
  idPierwszego: string
  idDrugiego: string
  opis: string
}

export type MiaraStrukturalna = {
  /** 0–100; ocena strukturalna, nie porównanie pikseli. */
  procent: number
  liczbaElementow: number
  liczbaElementowZGeometriaZXml: number
  odsetekGeometriiZXml: number
  nieobsluzoneWezly: Record<string, number>
  liczbaNieobsluzonychWezlow: number
  kolizje: KolizjaElementow[]
  /** Konkretne pozycje do poprawy, w kolejności ważności. */
  elementyDoPoprawy: string[]
}

const toleranciaKolizjiMm = 0.5
const karaZaKolizje = 10
const karaZaNieobsluzonyWezel = 4
const maksymalnaKaraZaWezly = 30

function splaszcz(elementy: ElementDokumentu[]): ElementDokumentu[] {
  return elementy.flatMap((element) => (element.rodzaj === 'blok' ? splaszcz(element.elementy) : [element]))
}

function czyTekst(element: ElementDokumentu): element is ElementTekstowyDokumentu {
  return element.rodzaj === 'tekst' || element.rodzaj === 'naglowek' || element.rodzaj === 'stopka'
}

function skroc(tekst: string) {
  const czysty = tekst.replace(/\s+/g, ' ').trim()

  return czysty.length > 32 ? `${czysty.slice(0, 31)}…` : czysty
}

/** Prostokąty tekstowe, które realnie nachodzą na siebie (część wspólna większa niż tolerancja w obu osiach). */
export function wykryjKolizjeTekstow(dokument: DokumentPomagiera): KolizjaElementow[] {
  return dokument.strony.flatMap((strona) => {
    const teksty = splaszcz(strona.elementy).filter(czyTekst).filter((element) => element.tekst.trim() && element.status !== 'ignorowany')

    return teksty.flatMap((a, indeks) =>
      teksty.slice(indeks + 1).flatMap((b) => {
        const wspolnaSzerokosc = Math.min(a.pozycja.x + a.pozycja.szerokosc, b.pozycja.x + b.pozycja.szerokosc) - Math.max(a.pozycja.x, b.pozycja.x)
        const wspolnaWysokosc = Math.min(a.pozycja.y + a.pozycja.wysokosc, b.pozycja.y + b.pozycja.wysokosc) - Math.max(a.pozycja.y, b.pozycja.y)

        return wspolnaSzerokosc > toleranciaKolizjiMm && wspolnaWysokosc > toleranciaKolizjiMm
          ? [{ idPierwszego: a.id, idDrugiego: b.id, opis: `Strona ${strona.numer}: „${skroc(a.tekst)}” nachodzi na „${skroc(b.tekst)}” (${wspolnaWysokosc.toFixed(1)} mm).` }]
          : []
      }),
    )
  })
}

/**
 * Miara strukturalna zgodności: jaka część geometrii pochodzi z XML źródła (a nie z wartości domyślnych),
 * ile konstrukcji źródła nie jest jeszcze odtwarzanych i czy teksty na siebie nie nachodzą.
 * Dokument bez informacji o źródle geometrii (starsze zapisy) jest traktowany ostrożnie – jako domyślny.
 */
export function policzMiareStrukturalna(dokument: DokumentPomagiera): MiaraStrukturalna {
  const elementy = dokument.strony.flatMap((strona) => splaszcz(strona.elementy))
  const geometriaZXml = dokument.metadane.zrodloGeometrii === 'xml'
  const nieobsluzoneWezly = dokument.metadane.nieobsluzoneWezlyDocx ?? {}
  const liczbaNieobsluzonychWezlow = Object.values(nieobsluzoneWezly).reduce((suma, liczba) => suma + liczba, 0)
  const kolizje = wykryjKolizjeTekstow(dokument)
  const liczbaElementowZGeometriaZXml = geometriaZXml ? elementy.length : 0
  const odsetekGeometriiZXml = elementy.length ? Math.round((liczbaElementowZGeometriaZXml / elementy.length) * 100) : 0
  const limitBezXml = geometriaZXml ? 100 : 60
  const kara = kolizje.length * karaZaKolizje + Math.min(maksymalnaKaraZaWezly, liczbaNieobsluzonychWezlow * karaZaNieobsluzonyWezel)
  const procent = Math.max(0, Math.min(limitBezXml, 100 - kara))

  return {
    procent,
    liczbaElementow: elementy.length,
    liczbaElementowZGeometriaZXml,
    odsetekGeometriiZXml,
    nieobsluzoneWezly,
    liczbaNieobsluzonychWezlow,
    kolizje,
    elementyDoPoprawy: [
      ...kolizje.map((kolizja) => kolizja.opis),
      ...Object.entries(nieobsluzoneWezly).map(([etykieta, liczba]) => `Nieodtworzone w układzie: ${etykieta} × ${liczba}.`),
      ...(geometriaZXml || !elementy.length ? [] : ['Geometria elementów pochodzi z wartości domyślnych, a nie z XML źródła – układ może odbiegać od wzoru.']),
    ],
  }
}
