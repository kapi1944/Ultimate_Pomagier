import type { SzablonChecklistyPaczki } from './modelChecklistyPaczki'
import { normalizujUstawieniaEtykiety } from './ustawieniaEtykietyPaczki'

const kluczMagazynu = 'ultimate-pomagier.checklisty-paczek.szablony'

function pobierzWszystkieSzablony(): SzablonChecklistyPaczki[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const zapis = localStorage.getItem(kluczMagazynu)
    const szablony = zapis ? JSON.parse(zapis) : []
    return Array.isArray(szablony) ? szablony.filter((szablon): szablon is SzablonChecklistyPaczki => Boolean(szablon?.id && szablon?.nazwa && Array.isArray(szablon?.paczki) && Array.isArray(szablon?.kategorie) && Array.isArray(szablon?.pozycje))) : []
  } catch {
    return []
  }
}

export function pobierzSzablonyChecklistPaczek() {
  return pobierzWszystkieSzablony().filter((szablon) => szablon.przeznaczenie !== 'etykieta')
}

export function pobierzSzablonyEtykietPaczek() {
  return pobierzWszystkieSzablony().filter((szablon) => szablon.przeznaczenie === 'etykieta')
    .map((szablon) => ({ ...szablon, ustawieniaEtykiety: normalizujUstawieniaEtykiety(szablon.ustawieniaEtykiety) }))
}

export function zapiszNowySzablonChecklisty(szablon: SzablonChecklistyPaczki) {
  if (typeof localStorage === 'undefined') return null
  const szablony = pobierzWszystkieSzablony()
  const nazwy = new Set(szablony.map((pozycja) => pozycja.nazwa.toLocaleLowerCase('pl')))
  const nazwa = szablon.nazwa.trim()
  if (!nazwa || nazwy.has(nazwa.toLocaleLowerCase('pl'))) return null
  localStorage.setItem(kluczMagazynu, JSON.stringify([...szablony, szablon]))
  return szablon
}
