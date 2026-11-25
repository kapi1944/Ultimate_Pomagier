# Katalog lokalizacji ładowany na żądanie (2026-11-25)

## Problem

Kartoteka startowa lokalizacji (`kartoteka_lokalizacje_miejscowosci_2019.csv`, 73 695 rekordów, 7,2 MB) była importowana do paczki JS przez `?raw`,
parsowana w całości przy pierwszym użyciu i trzymana w pamięci razem z mapami i kopiami (ok. 85–100 MB sterty). Na komputerach z małą ilością RAM
był to stały koszt każdej sesji, niezależnie od tego, czy użytkownik wpisywał jakąkolwiek miejscowość.

## Rozwiązanie

Źródłem danych nadal jest plik CSV. Skrypt `npm run katalog:lokalizacje` (`skrypty/generujKatalogLokalizacji.mjs`) generuje w `public/dane/lokalizacje/`:

- `indeks.json` (ok. 0,7 MB): lista województw, 42 283 unikalne nazwy posortowane alfabetycznie (kolacja polska) i maska bitowa województw dla każdej nazwy,
- `<województwo>.<skrót>.json` (16 plików, 0,1–0,9 MB): pełne rekordy zapisane kolumnowo (tabele powtarzalnych: województwo, gmina, powiat).
  Rekordy łączone („dolnośląskie lubelskie”) trafiają do pliku pierwszego członu.

Moduły (`src/kartoteki/lokalizacje/`):

| Plik | Odpowiedzialność |
| --- | --- |
| `katalogStatyczny.ts` | czysty format: budowa, walidacja i rozpakowanie plików |
| `wyszukiwanieMiejscowosci.ts` | podpowiedzi: najpierw nazwy zaczynające się od frazy, potem zawierające ją (alfabetycznie, limit łączny 50) |
| `ladowanieKatalogu.ts` | ładowanie indeksu i województw na żądanie, deduplikacja żądań, ponawianie po błędzie, subskrypcja wersji |
| `magazynLokalizacji.ts` | zmiany użytkownika w localStorage (format bez zmian) scalone z wczytanymi rekordami; podpowiedzi nazw |
| `ListaPodpowiedziMiejscowosci.tsx`, `usePodpowiedziMiejscowosci.ts` | wspólny `<datalist>` z separatorem „zawierają …” |

## Zgodność danych użytkownika

Klucz `ultimate-pomagier.kartoteki.lokalizacje` nadal przechowuje wyłącznie różnice względem katalogu startowego (zmodyfikowane rekordy startowe i własne
lokalizacje), w tym samym formacie. Zmiany są zawsze dostępne w całości, także zanim wczytane zostaną województwa. Potwierdzenie miejscownika dopisuje
jedną zmianę i zachowuje pozostałe.

## Zmiana semantyki

`pobierzLokalizacjeZMagazynu()` zwraca teraz rekordy **wczytanych** województw ze zmianami użytkownika. Pełna lista wymaga
`zaladujCalyKatalogLokalizacji()` (robi to zakładka „Lokalizacje” w kartotekach). Indeks Szczegółów uznaje nazwę za jednoznaczną dopiero, gdy wczytane są
wszystkie województwa, w których ona występuje; formularz wczytuje je automatycznie dla miejsc wpisanych w grupach.

## Znane ograniczenia

- Importer maila ocenia „potwierdzenie odmiany” na podstawie rekordów już wczytanych (zmiany użytkownika są zawsze dostępne; rekordy startowe mają
  `status_odmiany = false`).
- Nazwa zmieniona przez użytkownika nadal może być podpowiadana pod starą nazwą startową, dopóki istnieje w katalogu.
- Po zmianie CSV trzeba uruchomić `npm run katalog:lokalizacje`; test `katalogLokalizacji.test.ts` wykrywa nieaktualne pliki.
