import type { DopasowanieEtykiety, ZageszczenieEtykiety } from './ustawieniaEtykietyPaczki'

export function czyEtykietaPrzepelniona(strona: HTMLElement) {
  const granice = strona.getBoundingClientRect()
  const styl = getComputedStyle(strona)
  const skala = granice.width / parseFloat(styl.width)
  const margines = parseFloat(styl.paddingBottom) * skala
  const prawa = granice.right - parseFloat(styl.paddingRight) * skala
  const dol = granice.bottom - margines
  // Pomiar obejmuje rzeczywiste wiersze, zawinięte nazwy, nagłówek i opcjonalne QR.
  return Array.from(strona.querySelectorAll<HTMLElement>('header, .etykieta-paczki__tresc, footer, th, td')).some((element) => {
    const prostokat = element.getBoundingClientRect()
    return prostokat.bottom > dol + .5 * skala || prostokat.right > prawa + .5 * skala
      || element.scrollWidth > element.clientWidth + 1
  }) || strona.scrollHeight > strona.clientHeight + 1 || strona.scrollWidth > strona.clientWidth + 1
}

export function dopasujEtykiete(strona: HTMLElement, dopasowanie: DopasowanieEtykiety) {
  const warianty: ZageszczenieEtykiety[] = dopasowanie === 'automatyczne' ? ['standard', 'kompakt', 'maksymalny'] : [dopasowanie]
  for (const wariant of warianty) {
    strona.dataset.zageszczenie = wariant
    if (!czyEtykietaPrzepelniona(strona)) return true
  }
  return false
}
