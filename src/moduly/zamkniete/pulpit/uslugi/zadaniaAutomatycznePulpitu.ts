import { pobierzChecklistyPaczek, pobierzSzczegolyDoChecklisty } from '../../../dokumenty/generatory/checklisty_paczek/rejestrChecklistPaczek'
import { czyPozycjaJestAktywna } from '../../../dokumenty/generatory/checklisty_paczek/modelChecklistyPaczki'
import { generujZadaniaAutomatyczne } from '../logika/zadaniaAutomatyczne'
import { dodajDni } from '../logika/rutyny'

export function pobierzZadaniaAutomatyczne() {
  const checklisty = pobierzChecklistyPaczek()
  return generujZadaniaAutomatyczne(
    pobierzSzczegolyDoChecklisty().flatMap((szczegoly) => szczegoly.grupy.filter((grupa) => Boolean(grupa.dataOd)).map((grupa) => {
      const checklista = checklisty.find((pozycja) => pozycja.daneDokumentu.szczegolyOrganizacyjneId === szczegoly.id && pozycja.daneDokumentu.grupaId === grupa.id)
      const pozycjeMaterialow = checklista?.daneDokumentu.pozycje.filter((pozycja) => /materiał|prezentac/i.test(pozycja.nazwa) && pozycja.czyWymagana && czyPozycjaJestAktywna(pozycja))
      return {
        id: szczegoly.id,
        tytul: szczegoly.nazwa + ' \u2014 ' + grupa.nazwa,
        wlascicielId: szczegoly.opiekunId,
        data: dodajDni(grupa.dataOd, -7),
        czyMaTrenera: grupa.trenerzy.some((trener) => trener.imieNazwisko.trim()),
        czyDaneKlientaKompletne: Boolean(szczegoly.dane.nazwaKlienta.trim() || szczegoly.dane.nabywca.nazwa.trim()),
        czyMaterialyOdTreneraGotowe: pozycjeMaterialow?.every((pozycja) => pozycja.statusGotowosci === 'GOTOWE'),
      }
    })),
  )
}
