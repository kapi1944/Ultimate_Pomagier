import assert from 'node:assert/strict'
import { parsujTekstProgramu } from '../src/moduly/dokumenty/generatory/programy_szkolen/ParserTekstu.ts'
import { wyznaczLiterowoscOznaczen, wyznaczPoziomyProgramu } from '../src/moduly/dokumenty/generatory/programy_szkolen/oznaczeniaProgramu.ts'
import { pobierzTytulDokumentuProgramu } from '../src/moduly/dokumenty/generatory/programy_szkolen/tytulDokumentuProgramu.ts'

function policzPunkty(program: ReturnType<typeof parsujTekstProgramu>) {
  return program.dni.reduce(
    (suma, dzien) => suma + dzien.moduly.reduce((sumaModulow, modul) => sumaModulow + modul.podpunkty.length, 0),
    0,
  )
}

function sprawdz(nazwa: string, testRegresji: () => void) {
  testRegresji()
  console.log(`OK: ${nazwa}`)
}

sprawdz('punkty bez tytułu modułu nie otrzymują automatycznego nagłówka', () => {
  const program = parsujTekstProgramu(`Dzień 1 – Tworzenie i analiza umów
• Otwarcie szkolenia
• Przedstawienie celów i agendy`)

  assert.equal(program.dni[0].moduly[0].tytul, '')
  assert.equal(program.dni[0].moduly[0].indeksWierszaZrodlowego, undefined)
  assert.equal(policzPunkty(program), 2)
  assert.equal(JSON.stringify(program.dokumentBlokowy).includes('Zakres tematyczny'), false)
})

sprawdz('program 1-dniowy bez nagłówka dnia i z ramkową separacją modułów zachowuje moduły', () => {
  const program = parsujTekstProgramu(`
Program szkolenia
1. Wprowadzenie do kontroli dokumentów
- Cel szkolenia
- Zakres odpowiedzialności
2. Warsztat rozpoznawania ryzyk
- Studium przypadku
- Omówienie rezultatów
`)

  assert.equal(program.dni.length, 1)
  assert.equal(program.dni[0].czyDomyslny, true)
  assert.equal(program.dni[0].moduly.length, 2)
  assert.equal(policzPunkty(program), 4)
  assert.equal(program.dni[0].moduly[0].tytul, '1. Wprowadzenie do kontroli dokumentów')
})

sprawdz('program 1-dniowy z nagłówkiem dnia nie myli dnia z punktem programu', () => {
  const program = parsujTekstProgramu(`
Dzień 1: Podstawy procesu
Moduł 1: Otwarcie szkolenia
- Cele dnia
- Mapa procesu
Moduł 2: Ćwiczenia praktyczne
- Praca w grupach
`)

  assert.equal(program.dni.length, 1)
  assert.equal(program.dni[0].czyDomyslny, false)
  assert.equal(program.dni[0].tytul, 'Dzień 1')
  assert.equal(program.dni[0].tytulDnia, 'Podstawy procesu')
  assert.equal(program.dni[0].moduly.length, 2)
  assert.equal(policzPunkty(program), 3)
})

sprawdz('nagłówek modułu z przypadkowym punktorem nie staje się punktem poprzedniego modułu', () => {
  const program = parsujTekstProgramu(`
Dzień II
Moduł 7. Budowanie partnerskich relacji z kontrahentami
• negocjacje win-win,
• długofalowa współpraca biznesowa,
• Moduł 8. Warsztaty praktyczne – case studies
• symulacje negocjacji w podgrupach,
• analiza rzeczywistych sytuacji biznesowych,
`)

  assert.equal(program.dni[0].moduly.length, 2)
  assert.equal(program.dni[0].moduly[0].tytul, 'Moduł 7: Budowanie partnerskich relacji z kontrahentami')
  assert.equal(program.dni[0].moduly[1].tytul, 'Moduł 8: Warsztaty praktyczne – case studies')
  assert.equal(program.dni[0].moduly[1].podpunkty.length, 2)
})

sprawdz('program 2-dniowy z separatorem kolejnych pytań zachowuje dni i moduły', () => {
  const program = parsujTekstProgramu(`
Dzień 1: Analiza potrzeb
1. Jak rozpoznać wymagania klienta
- Pytania kontrolne
- Dane wejściowe
Dzień 2: Projektowanie rozwiązania
1. Jak dobrać dokumenty
- Lista decyzji
- Ryzyka eksportu
2. Jak zatwierdzić wynik
- Checklista jakości
`)

  assert.equal(program.dni.length, 2)
  assert.equal(program.dni[0].moduly.length, 1)
  assert.equal(program.dni[1].moduly.length, 2)
  assert.equal(policzPunkty(program), 5)
  assert.equal(program.dni[1].moduly[1].podpunkty[0].tresc, 'Checklista jakości')
})

sprawdz('program 3-dniowy bez separacji modułów nie spłaszcza list zagnieżdżonych', () => {
  const program = parsujTekstProgramu(`
Dzień 1: Fundamenty
## Moduł otwierający
- Kontekst
  - Definicje
Dzień 2: Praktyka
## Moduł warsztatowy
- Ćwiczenie
  - Omówienie rezultatów
Dzień 3: Podsumowanie
## Moduł zamykający
- Plan wdrożenia
`)

  assert.equal(program.dni.length, 3)
  assert.equal(program.dni.every((dzien) => dzien.moduly.length === 1), true)
  assert.equal(policzPunkty(program), 5)
  assert.equal(program.dni[0].moduly[0].podpunkty[1].poziom, 1)
  assert.equal(program.dni[1].moduly[0].podpunkty[1].tresc, 'Omówienie rezultatów')
})

sprawdz('dedykowany tytuł nie usuwa pierwszego modułu programu', () => {
  const program = parsujTekstProgramu(`Wprowadzenie do szkolenia;
• Powitanie uczestników.
• Zapoznanie uczestników z planem.`)

  assert.equal(pobierzTytulDokumentuProgramu('Profesjonalna obsługa klienta'), 'Profesjonalna obsługa klienta')
  assert.equal(program.dni[0].moduly[0].tytul, 'Wprowadzenie do szkolenia;')
  assert.equal(policzPunkty(program), 2)
})

sprawdz('pierwszy nagłówek dnia pozostaje częścią programu', () => {
  const program = parsujTekstProgramu(`Dzień 1
Wprowadzenie do szkolenia;
• Powitanie uczestników.`)

  assert.equal(pobierzTytulDokumentuProgramu('Profesjonalna obsługa klienta'), 'Profesjonalna obsługa klienta')
  assert.equal(program.dni[0].tytul, 'Dzień 1')
  assert.equal(program.dni[0].moduly[0].tytul, 'Wprowadzenie do szkolenia;')
})

sprawdz('pusta wartość tytułu nie przejmuje pierwszej linii treści', () => {
  const program = parsujTekstProgramu(`Wprowadzenie do szkolenia;
• Powitanie uczestników.`)

  assert.equal(pobierzTytulDokumentuProgramu(''), 'Program szkolenia')
  assert.equal(program.dni[0].moduly[0].tytul, 'Wprowadzenie do szkolenia;')
})

sprawdz('puste linie przed dniem nie zmieniają jego klasyfikacji', () => {
  const program = parsujTekstProgramu(`

Dzień 1
Wprowadzenie do szkolenia;
• Powitanie uczestników.`)

  assert.equal(program.dni[0].tytul, 'Dzień 1')
  assert.equal(program.dni[0].moduly[0].tytul, 'Wprowadzenie do szkolenia;')
})

sprawdz('zmiana tytułu dokumentu nie zmienia sparsowanej struktury programu', () => {
  const program = parsujTekstProgramu(`Dzień 1
Wprowadzenie do szkolenia;
• Powitanie uczestników.`)
  const strukturaPrzedZmianaTytulu = JSON.stringify(program.dni)

  assert.equal(pobierzTytulDokumentuProgramu('Pierwszy tytuł'), 'Pierwszy tytuł')
  assert.equal(pobierzTytulDokumentuProgramu('Zmieniony tytuł'), 'Zmieniony tytuł')
  assert.equal(JSON.stringify(program.dni), strukturaPrzedZmianaTytulu)
  assert.equal(program.dni[0].moduly[0].tytul, 'Wprowadzenie do szkolenia;')
})

const programZLiterami = [
  '1. Otwarcie szkolenia',
  'A. Powitanie uczestników',
  'B. Autoprezentacja uczestników',
  'C. Identyfikacja wyzwań',
  'D. Wprowadzenie do warsztatu',
  '',
  'Wprowadzenie do zarządzania projektami',
  'A. Projekt – definicja',
  'B. Rodzaje projektów',
  'C. Cykl życia projektu',
  'D. Rola standardów',
  'E. Czynniki',
  'F. Kompetencje',
  '',
  'Inicjowanie projektu',
  'A. Określenie celu',
  'B. Analiza potrzeb',
  'C. Definiowanie zakresu',
  'D. Tworzenie konspektu',
]

sprawdz('litery C, D, I, L, M, V, X w liście A. B. C. nie są cyframi rzymskimi', () => {
  assert.deepEqual(wyznaczLiterowoscOznaczen(['A. a', 'B. b', 'C. c', 'D. d']), [true, true, true, true])
  assert.deepEqual(wyznaczLiterowoscOznaczen(['H. h', 'I. i', 'J. j']), [true, true, true])
  assert.deepEqual(wyznaczLiterowoscOznaczen(['I. a', 'II. b', 'III. c', 'IV. d', 'V. e']), [false, false, false, false, false])
})

sprawdz('lista A. B. C. D. po numerowanym punkcie i tytuły bez numeru dostają poprawne poziomy', () => {
  const wiersze = programZLiterami.filter(Boolean).map((tresc) => ({ tresc, poziom: 0 }))

  assert.deepEqual(wyznaczPoziomyProgramu(wiersze), [0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1])
})

sprawdz('parser strukturalny nie robi modułów z liter C. i D.', () => {
  const program = parsujTekstProgramu(programZLiterami.join('\n'), { czyScalacKontynuacje: false })
  const moduly = program.dni.flatMap((dzien) => dzien.moduly)

  assert.deepEqual(moduly.map((modul) => modul.podpunkty.length), [4, 6, 4])
  assert.equal(moduly[1].tytul, 'Wprowadzenie do zarządzania projektami')
})

sprawdz('separatory wierszy Worda (U+2028, tabulator pionowy) działają jak enter', () => {
  const tekst = programZLiterami.join('\n').replace('B. Autoprezentacja', '\u2028B. Autoprezentacja').replace('C. Identyfikacja', '\u000BC. Identyfikacja')
  const moduly = parsujTekstProgramu(tekst, { czyScalacKontynuacje: false }).dni.flatMap((dzien) => dzien.moduly)

  assert.deepEqual(moduly.map((modul) => modul.podpunkty.length), [4, 6, 4])
})
