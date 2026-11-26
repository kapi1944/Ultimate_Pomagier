import { pobierzDostepneSkroty } from '../menu/preferencjeMenu'
import { czyMozeZarzadzacUzytkownikami } from '../../kartoteki/uzytkownicy/uprawnienia'
import { czyJestPracownikiemWewnetrznym } from '../../kartoteki/uzytkownicy/typyUzytkownikow'
import { utworzWyszukiwarke, type WynikWyszukiwania, type ZrodloWyszukiwania } from './mechanizmWyszukiwania'

const zrodla: ZrodloWyszukiwania[] = [
  {
    id: 'Moduły', czyDostepne: () => true,
    async pobierz({ uzytkownik }) {
      return pobierzDostepneSkroty().filter((skrot) => (czyJestPracownikiemWewnetrznym(uzytkownik) || ['profil_uzytkownika', 'ustawienia'].includes(skrot.widok)) && (skrot.widok !== 'kartoteki_uzytkownicy' || czyMozeZarzadzacUzytkownikami(uzytkownik))).map((skrot) => ({
        id: `modul:${skrot.widok}`, kategoria: 'Moduły i funkcje', nazwa: skrot.etykieta, opis: skrot.opis, informacje: 'Otwórz moduł', cel: { widok: skrot.widok },
      }))
    },
  },
  {
    id: 'Polecenia', polecenia: true, czyDostepne: czyJestPracownikiemWewnetrznym,
    async pobierz({ uzytkownik }) {
      const { pobierzKontoSzczegolow, czyKontoMozeEdytowacSzczegoly } = await import('../../moduly/zamkniete/szczegoly_organizacyjne/uzytkownicySzczegolow')
      const konto = pobierzKontoSzczegolow(uzytkownik.id)
      const polecenia: { id: string; nazwa: string; cel: WynikWyszukiwania['cel'] }[] = [
        { id: 'szkolenie', nazwa: 'Utwórz szkolenie', cel: { widok: 'zamkniete_szczegoly_organizacyjne_nowe' } },
        { id: 'zadanie', nazwa: 'Dodaj zadanie', cel: { widok: 'pulpit', akcja: 'dodaj' } },
        { id: 'klient', nazwa: 'Dodaj klienta', cel: { widok: 'kartoteki_klienci', akcja: 'dodaj' } },
        { id: 'magazyn', nazwa: 'Otwórz magazyn', cel: { widok: 'zakupy_magazyn' } },
        { id: 'dokument', nazwa: 'Otwórz generator dokumentów', cel: { widok: 'programy_szkolen' } },
      ]
      return polecenia.filter((polecenie) => polecenie.id !== 'szkolenie' || (konto && czyKontoMozeEdytowacSzczegoly(konto, '', true))).map((polecenie) => ({ ...polecenie, id: `polecenie:${polecenie.id}`, kategoria: 'Szybkie polecenia', opis: 'Przejdź do formularza lub modułu', informacje: '', cel: polecenie.cel }))
    },
  },
  {
    id: 'Klienci', czyDostepne: czyJestPracownikiemWewnetrznym,
    async pobierz() {
      const { pobierzKlientowZKartoteki } = await import('../../kartoteki/klienciKartoteki')
      return pobierzKlientowZKartoteki().map((klient) => ({ id: `klient:${klient.id}`, kategoria: 'Klienci', nazwa: klient.nazwa, opis: `${klient.miasto} · NIP ${klient.nip}`, informacje: klient.koordynator, cel: { widok: 'kartoteki_klienci', rekordId: klient.id } }))
    },
  },
  {
    id: 'Trenerzy', czyDostepne: czyJestPracownikiemWewnetrznym,
    async pobierz() {
      const { pobierzPelnaKartotekeTrenerow } = await import('../../kartoteki/trenerzyKartoteki')
      return pobierzPelnaKartotekeTrenerow().map((trener) => ({ id: `trener:${trener.id}`, kategoria: 'Trenerzy', nazwa: `${trener.imie} ${trener.nazwisko}`, opis: trener.email, informacje: `${trener.telefon} · ${trener.status}`, cel: { widok: 'kartoteki_trenerzy', rekordId: trener.id } }))
    },
  },
  {
    id: 'Szkolenia', czyDostepne: czyJestPracownikiemWewnetrznym,
    async pobierz({ uzytkownik }) {
      const { pobierzOpublikowaneSzczegoly, pobierzKopieRobocze } = await import('../../moduly/zamkniete/szczegoly_organizacyjne/uslugi/magazynWersjiRoboczych')
      const { pobierzKontoSzczegolow, czyKontoMozeWidziecKopie } = await import('../../moduly/zamkniete/szczegoly_organizacyjne/uzytkownicySzczegolow')
      const konto = pobierzKontoSzczegolow(uzytkownik.id)
      const kopie = konto ? pobierzKopieRobocze().filter((kopia) => czyKontoMozeWidziecKopie(konto, kopia)) : []
      return [...pobierzOpublikowaneSzczegoly().map((rekord) => ({ rekord, roboczy: false })), ...kopie.map((rekord) => ({ rekord, roboczy: true }))].map(({ rekord, roboczy }) => ({
        id: 'szkolenie:' + rekord.id, kategoria: 'Szkolenia', nazwa: rekord.nazwa,
        opis: rekord.dane.nazwaKlienta,
        informacje: (roboczy ? 'Kopia robocza' : 'Opublikowane') + ' · ' + rekord.grupy.map((grupa) => grupa.nazwa + ' ' + grupa.dataOd + ' ' + grupa.dataDo).join(' · '),
        cel: { widok: roboczy ? 'zamkniete_szczegoly_organizacyjne_kopie_robocze' : 'zamkniete_szczegoly_organizacyjne_lista', rekordId: rekord.id },
      }))
    },
  },
  {
    id: 'Dokumenty', czyDostepne: czyJestPracownikiemWewnetrznym,
    async pobierz({ uzytkownik }) {
      const { repozytoriumWspolnychDokumentow } = await import('../../wspolne/dokumenty/rejestrDokumentow')
      const { pobierzKonfiguracjeTypuDokumentu } = await import('../../wspolne/dokumenty/konfiguracjaDokumentow')
      return repozytoriumWspolnychDokumentow.pobierzWszystkie().filter((dokument) => dokument.typ !== 'SZCZEGOLY_ORGANIZACYJNE' && !dokument.czyUsunietyMiekko && !dokument.czyZarchiwizowany && (dokument.widocznosc !== 'prywatny' || dokument.wlascicielId === uzytkownik.id || dokument.autorId === uzytkownik.id || czyMozeZarzadzacUzytkownikami(uzytkownik))).map((dokument) => ({
        id: `dokument:${dokument.id}`, kategoria: 'Dokumenty', nazwa: dokument.tytul,
        opis: pobierzKonfiguracjeTypuDokumentu(dokument.typ)?.etykieta ?? dokument.typ,
        informacje: `${dokument.status} · ${dokument.zmodyfikowano.slice(0, 10)}`,
        cel: { widok: 'dokumenty_wszystkie', dokumentId: dokument.id },
      }))
    },
  },
  {
    id: 'Zadania', czyDostepne: czyJestPracownikiemWewnetrznym,
    async pobierz({ uzytkownik }) {
      const { pobierzStanPulpitu } = await import('../../moduly/zamkniete/pulpit/uslugi/magazynPulpitu')
      const { pobierzZadaniaAutomatyczne } = await import('../../moduly/zamkniete/pulpit/uslugi/zadaniaAutomatycznePulpitu')
      const { czyZadanieWidoczneDlaUzytkownika } = await import('../../moduly/zamkniete/pulpit/logika/zadania')
      return [...pobierzStanPulpitu().zadaniaReczne, ...pobierzZadaniaAutomatyczne()].filter((zadanie) => czyZadanieWidoczneDlaUzytkownika(zadanie, uzytkownik.id)).map((zadanie) => ({
        id: `zadanie:${zadanie.id}`, kategoria: 'Zadania i terminarz', nazwa: zadanie.tytul, opis: zadanie.opis ?? '', informacje: `${zadanie.data} ${zadanie.godzina ?? ''} · ${zadanie.status}`, cel: { widok: 'pulpit', rekordId: zadanie.id },
      }))
    },
  },
  {
    id: 'Magazyn', czyDostepne: czyJestPracownikiemWewnetrznym,
    async pobierz() {
      const { pobierzLokalizacjeMagazynowe } = await import('../../moduly/zakupy/uslugi/magazynLokalizacji')
      const magazyn = pobierzLokalizacjeMagazynowe()
      if (magazyn.blad) throw new Error(magazyn.blad)
      return magazyn.daneMagazynowe.produkty.map((produkt) => ({ id: `produkt:${produkt.id}`, kategoria: 'Magazyn', nazwa: produkt.nazwa, opis: produkt.rodzaj.replaceAll('_', ' '), informacje: produkt.jednostkaMiary, cel: { widok: 'zakupy_magazyn', rekordId: produkt.id } }))
    },
  },
]

export const wyszukiwarkaGlobalna = utworzWyszukiwarke(zrodla)
