---
title: "Plan rozwoju modułu magazynowego — Ultimate Pomagier"
wersja: "1.0"
data: "2026-11-19"
jezyk: "pl-PL"
status: "AUDYT I PLAN — brak implementacji, brak commitów, brak migracji danych"
wejscie: "ULTIMATE_POMAGIER_MAGAZYN_SPECYFIKACJA_I_ROADMAPA_DLA_CLAUDE_2026-11-18.md"
---

# Plan rozwoju modułu magazynowego

## 0. Jak czytać ten dokument

- Każde twierdzenie o stanie kodu ma oznaczenie źródła: **[KOD]** — odczytane z plików tego checkoutu; **[DOC]** — z dokumentów repozytorium; **[SPEC]** — z dokumentu wejściowego (intencja użytkownika); **[PROPOZYCJA]** — rekomendacja do zatwierdzenia; **[NIEZWERYFIKOWANE]** — nie sprawdzone w tej sesji.
- Audyt był **statyczny**: przeczytano kod, testy, workflow CI i dokumenty. **Nie uruchamiano** `npm test`, `lint`, `build`, aplikacji ani testów przeglądarkowych. Żaden wynik testów w tym dokumencie nie jest „zielony z tej sesji" — cytuję tylko to, co jest zapisane w raportach repozytorium.
- Zakres tego dokumentu: audyt AS-IS, luki, architektura docelowa, plan zadań, macierz `MAG-01…MAG-20`, rejestr decyzji. Zadania wykonawcze (sekcja 6) są napisane tak, by każde dało się wkleić jako osobne polecenie implementacyjne.

---

## 1. Podsumowanie wykonawcze

1. **Moduł magazynowy już istnieje i jest sensownym fundamentem** — hierarchia lokalizacji ze stabilnymi ID, plan 2D, stany liczone z lokalizacji, przyjęcie/przesunięcie z historią, migracja v1→v2, ochrona zapisu i uprawnienia. Plan: **rozwijać, nie przepisywać**.
2. **Największa luka nie jest wizualna, tylko integralnościowa:** księga ruchów nie jest dziś *wymuszana* względem stanów (serwis zapisu nie sprawdza, że zmiana `ilosc` w `stanyWLokalizacjach` ma pokrycie w nowym ruchu — patrz §2.4, F-03). Zanim powstaną wydania, korekty i inwentaryzacje, trzeba tę gwarancję dodać.
3. **Model ruchu jest za wąski** dla wydań/zwrotów/korekt: brak przyczyny, odbiorcy, korelacji operacji, kierunku korekty i rodzaju `ZWROT`; `ilosc` dopuszcza `0` (F-04).
4. **Nie ma żadnego kodu skanowania QR ani uprawnień kamery**; istniejący koder QR (paczki) jest stałą, minimalną implementacją (wersja 6-L, tryb bajtowy, ≤134 B, maska 0, **bez dekodera**) i koduje **URL zbudowany z `window.location.origin`**, co na desktopie/Androidzie nie daje adresu otwieralnego z telefonu (F-08).
5. **Dane są lokalne dla urządzenia/originu.** Relacyjny adapter SQLite (`serwer/dane/magazynSqlite.mjs`) istnieje, ale jest **odłączony od sieci**, ma słownik rodzajów rekordów tylko dla szkoleń/dokumentów/paczek (brak rodzajów magazynowych) i — wg `docs/architektura/e4-uruchomienie.md` — wymaga autoryzowanego API, adapterów klientów i kolejki zmian (F-09). Plan **nie obiecuje** wspólnego stanu zespołu; wprowadza ADR-bramkę i projektuje model tak, by synchronizacja była później możliwa (księga append-only z `operacjaId`).
6. **Baza robocza tego checkoutu nie jest czystym `main`** (F-01): gałąź `audit/integracja-galezi-release-4.1.0`, 3 commity przed i 2 za `origin/main`, 14 zmodyfikowanych + 2 nieśledzone pliki, w tym **niezatwierdzona nawigacja historii mapy magazynu**. Pierwszym krokiem implementacji musi być uporządkowanie bazy (decyzja użytkownika — nie wykonuję jej sam).
7. **Rekomendowany pierwszy etap implementacyjny (E1):** uporządkowanie bazy + włączenie testu przeglądarkowego magazynu do CI + kompaktowa nawigacja kodami (tylko UI, bez zmiany modelu danych) — szczegóły w §8-E.

---

## 2. Raport stanu obecnego (AS-IS)

### 2.1. Baza audytu — Git [KOD/Git]

| Element | Wartość |
|---|---|
| Katalog | `…/Ultimate_Pomagier_4_aktualny` (nie `Ultimate_Pomagier_3_5`) |
| Remote | `origin` = `https://github.com/kapi1944/Ultimate_Pomagier.git` |
| Gałąź | `audit/integracja-galezi-release-4.1.0` |
| HEAD | `9002160637f4dd6b50b5c880d110258ebe770a6a` („poprawiacz") |
| `origin/main` (lokalna referencja) | `7c8165344b8187bf456634f6c56274a2236550c0` — **zgodny z SHA snapshotu z dokumentu wejściowego**; `git fetch --dry-run` nie zmienił referencji, więc aktualność względem GitHub nie została potwierdzona |
| Relacja do `origin/main` | HEAD ma 3 commity, których nie ma na main (`9002160`, `0134848`, `7f2bfe5`), i brakuje mu 2 merge'y (`0da8543`, `7c81653`); merge-base `ecf8abe` |
| Kod magazynu w HEAD vs `origin/main` | **Identyczny** — `git diff origin/main -- src/moduly/zakupy` pokazuje wyłącznie niezatwierdzone zmiany robocze (poniżej) |
| Stashe | 5 wpisów (`git stash list`), m.in. „zabezpieczenie-generator-programow-szkolen" — nie ruszane |

**Niezatwierdzone zmiany robocze (nie moje, nie ruszane):**

- **Dotyczące magazynu:** `src/moduly/zakupy/magazyn/PlanMagazynu.tsx`, `WidokMapyMagazynu.tsx`, nowy `src/moduly/zakupy/logika/nawigacjaMapyMagazynu.ts` i `testy/nawigacjaMapyMagazynu.test.ts` — **nawigacja po planie przez History API** (Wstecz/Dalej/Poziom wyżej, wejście dwuklikiem lub Enterem). Test jest już podpięty w `package.json` (skrypt `test`).
- **Niepowiązane z magazynem:** `UkladAplikacji.tsx`, `typyNawigacji.ts`, `konfiguracjaGeneratorow.ts` (usunięcie widoków „kosz" dokumentów, dodanie `programy_szkolen_wszystkie`), `WidokPulpitu.tsx`, `pulpit.css`, `vite.config.ts`, `docs/v4/*`, kilka testów. Wyglądają na pozostałość innej linii pracy (por. stashe) — **ryzyko przypadkowego wciągnięcia do commita magazynowego** (patrz M0.1).
- Ostrzeżenia `LF will be replaced by CRLF` dla `package.json`, `docs/v4/*` — normalizacja końców linii warta ustalenia przed commitami.

### 2.2. Weryfikacja twierdzeń dokumentu wejściowego

| # | Twierdzenie ze SPEC | Werdykt po audycie kodu |
|---|---|---|
| 1 | Hierarchia `OBIEKT/STREFA/REGAL/POLKA/POZYCJA`, ID, kody, aktywność | **Potwierdzone** — `modele/zakupy.ts:115-137`, `logika/mapaMagazynu.ts:4-7`. W v2 typ nie wymusza poziomu (test „adresowanie nie ma limitu pięciu poziomów"). |
| 2 | Pełny adres z kodów przodków, `/` | **Potwierdzone** — `mapaMagazynu.ts:98`. **Uwaga (nowe):** wpisanie w polu *kod* `MAG/L/REG-02` **nie jest błędem** — `normalizujKodLokalizacji` zamienia `/` na `-` i powstaje jeden segment `MAG-L-REG-02`. Dokument opisuje to jako „nieprawidłowy lokalny kod" (GAP-08); w praktyce to **ciche przekształcenie** i pułapka UX → M2.2. |
| 3 | Unikalność kodu wśród rodzeństwa, cykle, integralność | **Potwierdzone** — `walidujLokalizacjeMapy`. Unikalność dotyczy też korzeni (`null` jako rodzic). |
| 4 | Geometria w %, min 5%, opcjonalna | **Potwierdzone** (`ograniczProstokat`, walidacja). |
| 5 | Zoom 50–200%, siatka 5%, strzałki w edycji | **Potwierdzone** — `PlanMagazynu.tsx`. Rozmiar planu stały: wysokość `480 × zoom` px. |
| 6 | Kreator półek ≤ 500 / operację | **Potwierdzone**. Kody generowane: `POLKA-1…` (bez dopełnienia zerami), nazwa `Półka n`. |
| 7 | Plan pokazuje `kod` **i** `nazwa` (GAP-06) | **Potwierdzone** — `PlanMagazynu.tsx:76` (`<strong>{kod}</strong><span>{nazwa}</span>`); okruszki używają `nazwa` (`WidokMapyMagazynu.tsx:251`). |
| 8 | Dodawanie tylko produktu ilościowego | **Potwierdzone** — `dodajProdukt` w `WidokMapyMagazynu.tsx:183` zawsze `MATERIAL_ZUZYWALNY` + `ILOSCIOWY`; brak UI dla wariantów/egzemplarzy/edycji produktu. |
| 9 | `PRZYJECIE`/`PRZESUNIECIE` z historią | **Potwierdzone** — `przypiszProduktDoLokalizacji`. Jedna funkcja, rodzaj ruchu wynika z obecności `zrodloId`. |
| 10 | Modele i walidacja `WYDANIE`, `KOREKTA`, inwentaryzacji istnieją, ale bez procesów | **Potwierdzone** — tylko typy i walidacja kształtu w `normalizujDaneMagazynowe`; brak funkcji domenowych i UI. `ZWROT` **nie istnieje** nawet jako typ. |
| 11 | Ochrona niezapisanych zmian | **Potwierdzone** — `useOchronaNiezapisanegoDokumentu` + flagi formularzy. |
| 12 | Konflikt dwóch okien wykrywany | **Potwierdzone** — porównanie `zapisBazowy` (surowy JSON) w `zapiszLokalizacjeMagazynowe`. Tylko ten sam origin. |
| 13 | Klucz `ultimatePomagier.zakupy.lokalizacje.v1`, koperta v2, `zapisPrzedMigracja` | **Potwierdzone** — `magazynLokalizacji.ts`. |
| 14 | `czyMozeEdytowacMapeMagazynu` = aktywny pracownik wewnętrzny | **Potwierdzone** — `uprawnienia.ts:19`. To **jedyne** uprawnienie magazynowe; obejmuje i edycję planu, i ruchy stanowe, i dane produktów. |
| 15 | Generator QR istnieje dla paczek, brak skanera dla półek | **Potwierdzone i doprecyzowane** — patrz F-08. Brak w `src`/`package.json` jakiegokolwiek dekodera, `getUserMedia`, `BarcodeDetector`; brak wpisów uprawnień kamery w `src-tauri/capabilities` (tylko `desktop.json`, `dystrybucja.json`) — [NIEZWERYFIKOWANE] stan manifestu Androida w `src-tauri/gen/android` (wymaga spike'u M7.0). |
| 16 | Brak współdzielonego stanu | **Potwierdzone** — i **doprecyzowane**: SQLite adapter istnieje, ale jest odłączony i nie ma rodzajów magazynowych (F-09). |
| 17 | Mapa „bez zmyślonego układu" | **Potwierdzone** — odczyt nie tworzy lokalizacji; v1 dostaje domyślną geometrię siatki tylko w pamięci. |
| 18 | `docs/v4/rejestr-widokow.md` | **Częściowo nieaktualny** — linia 29: „V4-19: Magazyn i mapa — przyszłe zadanie", a tabele niżej (linie 90-91, 177-182) już wpisują widoki i komponenty V4-19. Do wyczyszczenia (M0.3). |
| 19 | `audyt-magazynow-danych.md` dotyczy `3_5` | **Potwierdzone** (nagłówek raportu); używany wyłącznie jako kontekst. |
| 20 | Raport 2026-11-10: „nie wykonano commita/pushu" | **Historyczne** — kod magazynu jest już na `main` (merge commit `7c81653` zawiera go; `git log -- src/moduly/zakupy` pokazuje m.in. `e6b1ecd`, `35da0b5`). |

### 2.3. Inwentarz komponentów [KOD]

| Plik | Rola | Rozmiar (linie) | Uwagi |
|---|---|---|---|
| `src/moduly/zakupy/modele/zakupy.ts` | Typy domeny zakupów+magazynu | 204 | `RuchMagazynowy.rodzaj: PRZYJECIE\|WYDANIE\|PRZESUNIECIE\|KOREKTA`; `Inwentaryzacja.status: ROBOCZA\|W_TRAKCIE\|ZAMKNIETA`; `StanZakupow.wersjaSchematu: 1` (projekcja, nie koperta). |
| `logika/mapaMagazynu.ts` | Hierarchia, kody, walidacja, operacje struktur, `znajdzMiejscaProduktu`, `pobierzProblemyLokalizacji` | 185 | `typyLokalizacji` to jedyny rejestr typów (dodanie typu = jedna lista + unia). |
| `logika/przypisaniaMagazynowe.ts` | Walidacja kolekcji; przyjęcie/przesunięcie | 92 | Jedyna funkcja ruchowa. Ruch: `crypto.randomUUID()`, czas `new Date().toISOString()`. |
| `logika/stanyMagazynowe.ts` | Agregacja, miarka 10-seg., filtry | 85 | Wiersz produktu sumuje stany z wariantami; wiersz wariantu — tylko wariant. |
| `logika/nawigacjaMapyMagazynu.ts` *(niezatw.)* | Historia przeglądarki dla planu | 41 | Czysta logika + test. |
| `uslugi/magazynLokalizacji.ts` | Odczyt/zapis jednego klucza | 54 | Atomowy `setItem`; blokady usuwania; ruchy porównywane po indeksie. |
| `uslugi/stanZakupow.ts` | Projekcja read-only (Pulpit + magazyn) | 22 | Kolekcje ofert/list/zamówień/przesyłek — puste. |
| `magazyn/WidokMapyMagazynu.tsx` | Koordynator widoku | 277 | Bardzo gęsty (długie linie); stan dużej liczby flag „niezapisane". |
| `magazyn/PlanMagazynu.tsx` | Plan 2D | 86 | `pobierzProblemyLokalizacji` liczone **per kafelek** (każde wywołanie 2× `wyliczStanyMagazynowe`) — potencjalny koszt przy setkach półek/produktów [NIEZWERYFIKOWANE pomiarem]. |
| `magazyn/DrzewoLokalizacji.tsx`, `KreatorLokalizacji.tsx`, `EdytorLokalizacji.tsx`, `SelektorLokalizacji.tsx`, `FormularzPrzypisania.tsx`, `WidokStanowMagazynowych.tsx` | UI | 19–74 | Tabela stanów: kolumna „Lokalizacja" pokazuje pełny kod (`pelnyKod`, z `nazwa` jako zapasowym) — OK. |
| `kartoteki/uzytkownicy/uprawnienia.ts` | Reguły uprawnień | — | Wzorzec: funkcje `czyMoze…`; odznaki: `WYSYLACZ, AKCEPTUJACY, EKSPORTER, ROZLICZAJACY, AUDYTOR`. |
| `dokumenty/generatory/checklisty_paczek/kodQrEtykiety.ts` | Koder QR | 94 | Stała wersja 6-L, bajty, ≤134 B, maska 0. `PanelEtykietPaczek.tsx` wywołuje go dla `new URL(adres, window.location.origin).href`. |
| `serwer/dane/magazynSqlite.mjs` | Relacyjny adapter SQLite (partie, wersje bazowe, ponowienia, historia z aktorem) | 191 | Rodzaje: SZKOLENIE, DOKUMENT, CHECKLISTA, PACZKA… — **bez** rodzajów magazynowych. |
| `wspolne/dane/backupDanych.ts`, `backupMigracjiE4.ts` | Backup | — | Kategoria `WSZYSTKO` wykrywa **wszystkie** klucze `localStorage`, więc klucz magazynu jest objęty. IndexedDB (zdjęcia paczek) obsługuje E4. |

### 2.4. Model danych i trwałość — ustalenia [KOD]

**Co działa dobrze (nie ruszać):** stabilne ID; normalizacja `pelnyKod` przy każdym odczycie (adres nie jest źródłem prawdy); zakaz usuwania lokalizacji i rekordów magazynowych (tylko dezaktywacja); blokada zmiany tożsamości/powiązań zapisanej pozycji stanu; porównanie historycznych ruchów po indeksie; atomowy zapis jednym `setItem`; błąd odczytu blokuje nadpisanie; migracja v1→v2 z `zapisPrzedMigracja`.

**Ustalenia wymagające akcji:**

| ID | Ustalenie | Dowód | Konsekwencja | Zadanie |
|---|---|---|---|---|
| F-01 | Baza robocza nie jest czystym `main` | §2.1 | Ryzyko wciągnięcia obcych zmian; niezatwierdzona nawigacja mapy | M0.1 |
| F-02 | Test przeglądarkowy magazynu **nie jest w CI** | `.github/workflows/ci.yml` wymienia 7 plików `*.przegladarka.test.mjs` — bez `hierarchiaMagazynu.przegladarka.test.mjs` (jest tylko `npm run test:magazyn:przegladarka`) | 5 scenariuszy akceptacyjnych magazynu nie chroni merge'a | M0.2 |
| F-03 | **Serwis zapisu nie wymusza zgodności `stany` ↔ `ruchy`** | `zapiszLokalizacjeMagazynowe` (linie 40-46) porównuje dla stanów tylko `produktId/wariantProduktuId/egzemplarzProduktuId/lokalizacjaId`, **nie `ilosc`** | Zmiana ilości bez ruchu przejdzie walidację zapisu; UI tego dziś nie robi, ale każdy nowy proces (wydanie, korekta, import) mógłby. „Integralność historii" jest konwencją, nie niezmiennikiem | M2.3 |
| F-04 | Model ruchu zbyt wąski | `RuchMagazynowy`: brak `przyczyna`, `odbiorca`, `operacjaId`, powiązania ze zwracanym wydaniem, kierunku korekty; `ilosc` dopuszcza `0` (`liczba()` używa `>= 0`) | Korekta ujemna nieopisywalna; zwrot niemożliwy; brak idempotencji | M2.3 |
| F-05 | Dodanie nowych **wartości enumeracji** (`SZAFA`, `ZWROT`, nowe statusy inwentaryzacji) jest **niezgodne wstecz** | Stary czytnik: `normalizujLokalizacjeMapy` rzuca „Nieznany typ lokalizacji."; `normalizujDaneMagazynowe` — „Nieprawidłowy ruch…". Błąd odczytu blokuje edycję i zapis (`obecny.blad`), **nie kasuje danych** | Wycofanie wersji aplikacji po zapisie nowych wartości = moduł magazynu nieużywalny do ponownej aktualizacji (degradacja, nie utrata) | M2.1 (sekwencja dwuetapowa) |
| F-06 | Pola **opcjonalne** są kompatybilne wstecz bez podnoszenia wersji koperty | Normalizatory kopiują rekordy z `...lokalizacja`/`Object.fromEntries` (pola nieznane zachowane); koperta: `...zrodlo` zachowane | Nowe pola (`poprzednieKody`, `przyczyna`, `przestrzenId`…) można dodawać w v2 addytywnie | M2.x |
| F-07 | Całość magazynu w **jednym kluczu `localStorage`** wraz ze zdjęciami (base64 ≤ 512 KB każde) i niekończącą się historią ruchów | `walidujLokalizacjeMapy` limit zdjęcia `710_000` znaków; `ruchyMagazynowe` rośnie | Limit pamięci przeglądarki (rzędu kilku MB, zależnie od silnika) — przy wielu zdjęciach lub latach ruchów zapis może zacząć kończyć się błędem quota. Błąd jest obsłużony (zachowanie danych), ale funkcjonalnie blokuje pracę | M2.4 |
| F-08 | QR: koder bez dekodera, URL zależny od originu, brak uprawnień kamery | §2.3 | Etykiety paczek na desktopie/Androidzie kodują adres, którego telefon nie otworzy bez publicznego originu HTTPS; ten sam błąd odtworzony w półkach byłby krytyczny | M7.0–M7.2 |
| F-09 | Współdzielenie danych: adapter SQLite odłączony; brak rodzajów magazynowych; E4 wymaga autoryzowanego API, adapterów klientów, kolejki zmian | `serwer/dane/magazynSqlite.mjs` (`rodziceRekordow`), `docs/architektura/e4-uruchomienie.md` („Pozostaje odłączony od żądań sieciowych") | Nie wolno obiecywać „jednego stanu dla wszystkich urządzeń" | M9.1 (ADR) |
| F-10 | Jedno uprawnienie na wszystko | `czyMozeEdytowacMapeMagazynu` używane w serwisie zapisu i UI | Brak rozdziału: przegląd / ruchy / korekty / zatwierdzanie inwentaryzacji / konfiguracja. Egzekwowanie jest po stronie klienta (lokalny storage) — **nie jest to bezpieczeństwo w sensie serwerowym**; zapisać to jawnie w ADR | M5.4 |
| F-11 | Operacje stanowe wiążą się z trybem „Edytuj plan" i „Zapisz konfigurację" | `przypisz()` wymaga `czyEdycja`; zmiany trafiają do pamięci do czasu `zapisz()` | Dzienny proces (wydanie papieru) nie powinien wymagać edycji planu; spec wymaga oddzielenia trybu oglądania/edycji/operacji | M5.2 |
| F-12 | Kreator domyślnie tworzy `POLKA-n` bez dopełnienia; testy asertują ten format | `dodajPolki`, `hierarchiaMagazynu.test.ts:47-56` | Zmiana domyślnego schematu kodów musi świadomie zaktualizować testy i nie może zmieniać kodów istniejących | M2.2 |
| F-13 | Mapa ma stałe `480px` wysokości i kafelki z dwoma liniami tekstu | `PlanMagazynu.tsx:58` | Kompaktowość/czytelność na 390–1920 px do zmierzenia | M4.1, M4.5 |
| F-14 | (WIP) Zastąpienie przycisku „Otwórz plan lokalizacji" dwuklikiem/Enterem na zaznaczonym kafelku | diff `WidokMapyMagazynu.tsx` | Dwuklik nie jest dostępny dla dotyku/czytników ekranu; Enter działa tylko na już zaznaczonym — **ryzyko regresji dostępności** | M4.5 |
| F-15 | Brak ustalonego fizycznego układu magazynu | SPEC §4.1 | Nie można dostarczyć „wiernej mapy"; dostarczamy edytor i pusty start | DEC-01…03 |
| F-16 | `walidujLokalizacjeMapy` pozwala na dowolny nieujemny `kolejnosc`; sortowanie po `kolejnosc` i `kod` (`localeCompare('pl')`) | `uporzadkujLokalizacje` | `PL-10` przed `PL-2` przy braku `kolejnosc`/dopełnienia — dlatego numeracja półek powinna być dopełniana (`PL-02`) lub sortowana po `kolejnosc` | M2.2 |
| F-17 | Katalog produktów jest wspólny dla Zakupów i Magazynu, ale **jedynym zapisem jest koperta magazynowa**; trasa `/zakupy/katalog-produktow` to widok „w przygotowaniu" | `WidokZakupow.tsx:65-69`, `stanZakupow.ts` | Katalog ma jedno źródło prawdy (koperta magazynu) — nie tworzyć drugiego magazynu produktów dla Zakupów | M3.1 |
| F-18 | Zapotrzebowania żyją w `ultimatePomagier.pulpit.v1` (`ZapotrzebowanieZakupowe`: `id, nazwa, ilosc, status, uwagi, utworzonePrzezId, utworzonoAt, linkiProduktow, zalaczniki`) — bez odniesienia do produktu | `pulpit.ts:71-81` | Integracja „niski stan → zapotrzebowanie" wymaga dodania opcjonalnego odniesienia do produktu **w istniejącym magazynie Pulpitu** oraz ochrony przed duplikatem | M8.1 |

### 2.5. Testy i CI [KOD/DOC]

- Testy domenowe magazynu: `hierarchiaMagazynu.test.ts` (14), `mapaMagazynu.test.ts`, `stanyMagazynowe.test.ts`, `zakupy.regresja.test.ts`, `nawigacjaMapyMagazynu.test.ts` (niezatw.) — wszystkie w skrypcie `npm test`.
- Przeglądarkowe: `hierarchiaMagazynu.przegladarka.test.mjs` (5 przypadków) — **tylko ręcznie** (`npm run test:magazyn:przegladarka`).
- CI (`ci.yml`): ubuntu, Node 24, `npm ci`, `npm test`, wybrane testy przeglądarkowe, magazyn danych/brama E4, desktop, dystrybucja, `lint`, `build`. Są też workflow'y Windows/Android/wydania.
- Raport 2026-11-10 podaje wyniki (43/43 domenowych, 3/3 przeglądarkowych — stan sprzed dopisania 2 przypadków) — **historyczne**, nie weryfikowane tu.
- Brak testów: dekodowania QR, skanowania, druku etykiet, wydań/zwrotów/korekt, inwentaryzacji, uprawnień magazynowych (poza serwisem), responsywności mapy (poza ręcznym przeglądem), wydajności.

---

## 3. Analiza luk — `MAG-01…MAG-20`

Legenda: **JEST** = działa i nie wymaga zmian; **CZĘŚĆ** = częściowo; **BRAK**; **DECYZJA** = wymaga decyzji przed implementacją.

| ID | Wymaganie | Status | Dowód / co jest | Czego brakuje |
|---|---|---|---|---|
| MAG-01 | Audyt implementacji | **JEST (ten dokument)** | §2 | Powtórzyć krótki audyt „delty" przed każdą fazą (M0.1). |
| MAG-02 | Katalog artykułów, warianty, jednostki | **CZĘŚĆ** | Typy `Produkt/WariantProduktu/EgzemplarzProduktu`; formularz dodaje tylko produkt ilościowy | CRUD produktów/wariantów/egzemplarzy, kategoria, kod SKU, import, stan początkowy; DEC-10 (przeliczniki). |
| MAG-03 | Krótkie kody i nawigacja kodami | **CZĘŚĆ** | Kod lokalny + `pelnyKod`; drzewo pokazuje kody | Kafelki i okruszki pokazują nazwy (F-06/F-13); brak schematu `REG-NN/SZ-NN/PL-NN`; pułapka `/` (§2.2 p.2); aliasy starych kodów. |
| MAG-04 | Regały i szafy | **BRAK/DECYZJA** | Typy: bez `SZAFA` | Typ `SZAFA` (DEC-05) z sekwencją zgodności (F-05). |
| MAG-05 | Wierny plan 2D pomieszczenia | **CZĘŚĆ/DECYZJA** | Edytowalny plan bez zmyślonych danych | Legenda, orientacja (DEC-02), ostrzeżenie o nakładaniu, obrys/drzwi (opcjonalnie), dane fizyczne (DEC-01). |
| MAG-06 | Widok półek wewnątrz regału/szafy + zawartość półki | **CZĘŚĆ** | Półki to dzieci regału na planie (wymagają geometrii); szczegóły pokazują zawartość | Widok pionowy półek niezależny od geometrii, kierunek numeracji (DEC-03), liczniki, historia półki. |
| MAG-07 | Wyszukiwanie produktu + miejsca + ilości | **CZĘŚĆ** | `znajdzMiejscaProduktu`, „Gdzie to leży?" | Wyszukiwanie wariantów, wyniki jako krótkie adresy, wyszukiwanie po kodzie SKU, test wydajności. |
| MAG-08 | Przyjęcia i przesunięcia | **JEST (logika) / CZĘŚĆ (UX)** | `przypiszProduktDoLokalizacji` | Rozdzielenie rodzaju operacji, idempotencja, zapis natychmiastowy (F-11). |
| MAG-09 | Wydania, zwroty, korekty | **BRAK** | Tylko typy `WYDANIE`/`KOREKTA` | Silnik + UI + model ruchu (F-04), `ZWROT`. |
| MAG-10 | Inwentaryzacja | **BRAK (model częściowy)** | `Inwentaryzacja`, `PozycjaInwentaryzacji`; wyliczanie „do przeliczenia" | Procesy: snapshot, liczenie, różnice, zatwierdzenie, idempotentne księgowanie; statusy. |
| MAG-11 | Alarmy stanów i zapotrzebowania | **CZĘŚĆ** | Miarka, filtry, minimum/cel | Jawne statusy (brak progu/0/poniżej min/…), spójność koloru z minimum, akcja „Zgłoś zapotrzebowanie" (F-18). |
| MAG-12 | QR półek: payload, druk, skan, deep-link, fallback | **BRAK** | Koder paczek | Cały pion (F-08). |
| MAG-13 | Uprawnienia, audyt, polityka korekt | **CZĘŚĆ** | Jedno uprawnienie; `wykonanePrzezId` w ruchu | Rozdział uprawnień (F-10), pola audytowe, polityka korekt. |
| MAG-14 | Integracje: Pulpit, Zakupy, paczki, dokumenty | **BRAK** | Projekcja read-only | M8.x; bez niejawnych odpisów (DEC-09). |
| MAG-15 | Migracje, backup/restore, zgodność kodów/etykiet | **CZĘŚĆ** | v1→v2, backup `WSZYSTKO` | Złote fixtury, sekwencja wydań dla enumeracji (F-05), test restore z magazynem, aliasy kodów. |
| MAG-16 | Testy wieloplatformowe | **CZĘŚĆ** | Chrome headless lokalnie | CI dla magazynu (F-02), macierz urządzeń, Android/WebView, druk. |
| MAG-17 | Palety | **ODŁOŻONE** | — | Tylko rezerwacja punktów rozszerzalności (F10). |
| MAG-18 | Wspólny stan / synchronizacja | **DECYZJA** | Adapter SQLite odłączony | ADR-bramka (M9.1); implementacja warunkowa. |
| MAG-19 | Etykiety: unikalność, ponowny druk, stare kody, uszkodzony QR | **BRAK** | — | Dziennik wydrukowanych etykiet, wykrywanie rozbieżności kodu. |
| MAG-20 | UX kompaktowy 390–1920 px | **CZĘŚĆ** | Responsywny CSS, ręcznie sprawdzone szerokości | Zautomatyzowany test, kody bez zawijania, tryb dotykowy. |

---

## 4. Architektura docelowa

### 4.1. Zasady (z SPEC §1 i AGENTS.md)

1. Rozwijamy `src/moduly/zakupy/*` — **bez drugiego magazynu**; jedna koperta (klucz `ultimatePomagier.zakupy.lokalizacje.v1`, wersja 2, rozszerzana **addytywnie**).
2. **Stan zapasu = suma pozycji w lokalizacjach** (`stanyWLokalizacjach`); nie dodajemy pola „łączny stan". Dodajemy za to **niezmiennik: każda zmiana ilości ma pokrycie w ruchu** (M2.3).
3. Logika domenowa w czystych modułach `logika/*` z testami; komponenty tylko renderują i koordynują (AGENTS.md).
4. Zmiana widocznego kodu nigdy nie zmienia ID; QR niesie **ID**, człowiek czyta **kod**.
5. Dostępność: semantyczne przyciski, brak funkcji tylko-dwuklikowych, klawiatura, tekst + ikona + kolor.
6. Uprawnienia przez `kartoteki/uzytkownicy/uprawnienia.ts` — nie logika ról w komponentach.

### 4.2. Tożsamość: ID, kod, adres, QR

| Pojęcie | Gdzie żyje | Zmienność | Użycie |
|---|---|---|---|
| `id` lokalizacji (UUID) | `LokalizacjaMagazynowa.id` | **Niezmienne** | Relacje, QR, historia |
| `kod` (segment) | `LokalizacjaMapy.kod` | Zmienny (z walidacją) | Wyświetlanie, wyszukiwanie |
| `pelnyKod` | wyliczany | Zmienny | Etykieta drukowana, tabele |
| `poprzednieKody` **[PROPOZYCJA, nowe, opcjonalne]** | `string[]` pełnych adresów sprzed zmiany | Dopisywane przy zmianie kodu/rodzica | Wyszukiwanie po starym adresie, ostrzeżenie o starej etykiecie |
| `przestrzenId` **[PROPOZYCJA]** | koperta magazynu (UUID generowany przy pierwszym jawnym zapisie) | Niezmienne dla danych magazynu | Odróżnienie QR „z obcej instalacji" |
| SKU/`kodProduktu` **[PROPOZYCJA, opcjonalne]** | `Produkt` | Zmienne | Wyszukiwanie; **nie** adres półki |
| `numerSeryjny` egzemplarza | `EgzemplarzProduktu` | — | Bez związku z adresem półki |

### 4.3. Model danych — rozszerzenia (wszystkie addytywne w kopercie v2)

```text
LokalizacjaMagazynowa  + poprzednieKody?: string[]        (F-06: bezpieczne wstecz)
                       + widokPlanu?: { …orientacja, kierunekNumeracji… }  (DEC-02/03)
TypLokalizacjiMagazynowej + 'SZAFA'                        (F-05: wymaga sekwencji wydań)
Produkt                + kod?, kategoria?, opis?, opakowanie? (opis., bez przeliczania — DEC-10)
RuchMagazynowy         + operacjaId?: string               (idempotencja)
                       + przyczyna?: string  + odbiorca?: string
                       + koryguje?: RuchMagazynowy['id']   (ZWROT/KOREKTA → wskazanie)
                       + kierunek?: 'PLUS' | 'MINUS'       (KOREKTA)
RuchMagazynowy.rodzaj  + 'ZWROT'                           (F-05)
Inwentaryzacja         + statusy 'DO_ZATWIERDZENIA' | 'ANULOWANA'; + zatwierdzilId?, zakres, snapshotAt
PozycjaInwentaryzacji  + zaksiegowano?: boolean | ruchId   (idempotentne zamknięcie)
Koperta v2             + przestrzenId, + wydrukiEtykiet[]  (log: locId, pelnyKodWDruku, data, autorId)
Koperta v2             + ustawienia: { schematKodow, kierunekNumeracjiPolek }
```

**Niezmienniki do wymuszenia w serwisie zapisu (M2.3):**

- **N1:** dla każdej pozycji stanu `ilosc` = Σ(ruchy wpływające na tę pozycję) od „punktu zero" lub `ksiegaOd`-marker dla danych sprzed wprowadzenia niezmiennika (patrz DEC-18: dane legacy bez pełnej księgi nie są blokowane, tylko oznaczane).
- **N2:** ruch ma `ilosc > 0` (dla nowych ruchów; stare `0` tolerowane przy odczycie).
- **N3:** `PRZESUNIECIE` = jeden rekord, atomowo −źródło/+cel, suma bez zmian.
- **N4:** `ZWROT` wskazuje istniejące `WYDANIE` i nie przekracza jego pozostałej ilości.
- **N5:** zamknięcie inwentaryzacji jest idempotentne (powtórne zamknięcie nie tworzy ruchów).
- **N6:** historyczne ruchy niezmienne (już egzekwowane); korekta = nowy ruch.

### 4.4. Przepływ zapisu: dwa tryby

| Tryb | Co | Zapis |
|---|---|---|
| **Edycja planu** (istniejący) | struktura, kody, geometria, katalog | „Zapisz konfigurację" (jak dziś), strażnik niezapisanych zmian |
| **Operacje stanowe** (nowy, F-11) | przyjęcie/wydanie/przesunięcie/zwrot/korekta/liczenie | **Natychmiast**, append-only: usługa `zapiszOperacjeMagazynowe` ponownie czyta aktualny zapis, **re-waliduje** operację względem świeżego stanu, dopisuje ruch+skutek jednym `setItem`; przy zmianie stanu w innym oknie ponawia (operacje są re-walidowane, nie scalane na ślepo) |

To też przygotowuje grunt pod ewentualną synchronizację: ruchy z `operacjaId` są naturalnie idempotentne (por. tabela `ponowienia` w `magazynSqlite.mjs`).

### 4.5. Trwałość i współdzielenie (ADR-bramka M9.1)

| Wariant | Opis | Ocena |
|---|---|---|
| **A. Lokalny (obecny)** | jedno urządzenie/profil = jedna prawda; eksport/backup | Zero kosztu; **brak wspólnego stanu**. Bezpieczny punkt startowy. |
| **B. Serwer SQLite (E4)** | autoryzowane API + adaptery klientów + kolejka offline | Poprawny kierunek, ale to **osobny, duży program prac** zależny od E4; wymaga rodzajów rekordów magazynowych i reguł domenowych po stronie serwera. |
| **C. „Urządzenie magazynowe"** | jedno wskazane urządzenie (np. laptop w magazynie) jest właścicielem danych; telefony tylko skanują i zgłaszają operacje przez kolejkę/eksport | Pośrednie; wymaga mechanizmu przekazywania operacji — też zależny od B. |

**Rekomendacja:** wdrażać funkcje na wariancie A **z jawnym komunikatem w UI** („Dane magazynu są zapisane lokalnie na tym urządzeniu") i z `przestrzenId`, a wariant B planować jako osobny program po akceptacji E4. Nie obiecywać zespołowi wspólnego stanu.

### 4.6. Kontrakt QR (ADR-16, wymaga zatwierdzenia)

- **Payload** [PROPOZYCJA]: `UP-MAG:1:<przestrzenId>:<lokalizacjaId>` (+ opcjonalna suma kontrolna). Dla UUID: ~80 B — mieści się w limicie obecnego kodera (134 B), więc wystarczy dziś istniejąca wersja 6-L; dłuższy payload wymaga rozszerzenia kodera.
- **Opaque string, nie URL.** Powód (F-08): w aplikacji desktopowej/Android origin to lokalny schemat WebView, więc URL nie jest otwieralny z zewnętrznego telefonu. Skanowanie odbywa się **w aplikacji Pomagier** (kamera lub czytnik) → parser → nawigacja do lokalizacji. Wersja URL jest możliwa dopiero przy publicznym originu HTTPS (E4) i może zostać dodana jako `UP-MAG:2` bez łamania wersji 1.
- **Zasady:** brak sekretów i uprawnień w QR; skan **nigdy nie księguje**; odczyt wymaga sesji i uprawnień operacji; obsługa: nieznane/nieaktywne ID, zmieniony kod (porównanie `pelnyKodWDruku` z dziennika wydruków), zła wersja, obca `przestrzenId`, uszkodzony ciąg, pusty skan.
- **Współdzielenie kodu:** wydzielić renderer macierzy QR do `src/wspolne/` (np. `kodQr/zakodujQr.ts`) z re-eksportem w `checklisty_paczek/kodQrEtykiety.ts`, z **testem złotym** potwierdzającym identyczną macierz dla zestawu wejść **przed i po** (zero zmian zachowania paczek). Domeny etykiet (paczki vs półki) pozostają rozdzielone — wspólny jest tylko koder.

### 4.7. Plan 2D — dwie warstwy (bez ciężkiego silnika)

1. **Plan pomieszczenia** = dzieci wybranego węzła (jak dziś): kafelek pokazuje **tylko kod** + licznik/ikonę problemu; pełna nazwa w `title`, panelu szczegółów i `aria-label`.
2. **Widok mebla** (REGAL/SZAFA) = **automatyczny pionowy układ półek według `kolejnosc`** (kierunek wg DEC-03), niezależny od `polozenieNaMapie` — półki nie muszą mieć geometrii. Wiersz półki: `PL-03 · liczba pozycji · znacznik problemu`; kliknięcie → zawartość + historia.
3. Rozszerzenie geometrii tylko opcjonalnymi polami (`widokPlanu`), bez zmiany istniejących współrzędnych procentowych.

### 4.8. Uprawnienia [PROPOZYCJA]

Nowe funkcje w `uprawnienia.ts` (wzorzec istniejący), bez zmiany kont:

| Funkcja | Domyślna reguła (do zatwierdzenia — DEC-20) |
|---|---|
| `czyMozePrzegladacMagazyn` | aktywny użytkownik z dostępem do ZAKUPÓW |
| `czyMozeEdytowacMapeMagazynu` (istnieje) | bez zmian: aktywny pracownik wewnętrzny |
| `czyMozeWykonywacRuchyMagazynowe` | jak edycja planu (przyjęcie/wydanie/przesunięcie/zwrot) |
| `czyMozeKorygowacStanMagazynu` | `czyMozeAkceptowac` (admin lub odznaka `AKCEPTUJACY`) |
| `czyMozeZatwierdzacInwentaryzacje` | jak wyżej |
| `czyMozeEdytowacKatalogMagazynu` | pracownik wewnętrzny |

Nowa odznaka `MAGAZYNIER` byłaby czystszym modelem, ale zmienia kartotekę kont (usługa Rust, migracja kont) — **poza zakresem**, dopóki użytkownik jej nie zatwierdzi. Uwaga jawnie w ADR: kontrola jest po stronie klienta nad lokalnym storage.

---

## 5. Graf zależności i kolejność

```text
F0 Baza i CI ─┬─► F1 ADR/kontrakty (doc) ─┬─► F2 Fundament danych ─┬─► F3 Katalog ──────────┐
              │                            │                       ├─► F5 Operacje ─► F6 Inwentaryzacja
              │                            │                       └─► F4 Mapa/kody ─────────┤
              ├─► M4.1 (kody w UI, bez modelu)                                              │
              ├─► M7.0 Spike QR/kamera (równolegle od startu)                               │
              └────────────────────────────► F7 QR/etykiety (M7.1–M7.2 po ADR-16; M7.3–M7.6 po F2+F5) ─┤
                                                                                            ▼
                                                                   F8 Integracje/backup/raporty ─► F9 Współdzielenie (ADR-gate)
                                                                                                   F10 Palety (później)
```

**Warunki startu:** F2 wymaga F0+F1; F5 wymaga M2.3; F6 wymaga F5; M7.3+ wymaga M2.1/M2.2 (kody) i `przestrzenId` (M2.4); M8.1 wymaga M3.1 i F5.

---

## 6. Zadania wykonawcze

**Szablon każdego zadania:** Cel · Zakres · Istniejące · Pliki · Zależności · Ryzyka/migracje · Testy · Kryteria akceptacji/DoD · Wycofanie. Priorytety: P0 (fundament/ochrona danych), P1 (funkcje główne), P2 (później).

**Wspólne DoD dla każdego zadania implementacyjnego** (z AGENTS.md): `npm test`, `npm run lint`, `npm run build`, `git diff --check` zielone; diff przejrzany; brak `any`/`@ts-ignore`; testy zachowania; aktualizacja `docs/v4/manifest-widokow.json` + `rejestr-widokow.md` przy nowych widokach/komponentach (testy `v4Rejestr` to egzekwują); raport zadania w `docs/audyty/`; brak zmian poza zakresem; commit tylko po poleceniu (AGENTS.md: stała zgoda na push po commicie).

### FAZA 0 — Baza, higiena, ochrona CI (P0)

#### M0.1 Uporządkowanie bazy roboczej — *decyzja użytkownika*
- **Cel:** wystartować z jednoznacznego punktu bazowego.
- **Zakres:** (a) rozstrzygnąć los niezatwierdzonej nawigacji mapy (commit jako osobny PR „nawigacja planu magazynu" po przeglądzie; zob. M4.5 uwagi); (b) rozstrzygnąć zmiany niepowiązane (usunięcie widoków „kosz" itd.) — **nie mieszać** z magazynem; (c) ustalić integrację z `origin/main` (2 merge'e) — merge/rebase tylko za zgodą; (d) ustalić końce linii (CRLF/LF) dla `package.json`, `docs/v4/*`.
- **Istniejące:** `AGENTS.md` (sekcja „Zmiany stanu repozytorium"), stashe.
- **Pliki:** brak zmian kodu; ewentualnie `.gitattributes` (tylko po zgodzie).
- **Ryzyka:** przypadkowe wciągnięcie cudzych zmian; utrata WIP. **Zabezpieczenie:** `git stash`/commit tylko wskazanych plików, bez `reset`/`clean`.
- **Testy:** pełny `npm test`/`lint`/`build` na wybranej bazie jako **baseline** zapisany w raporcie (liczby, czasy, znane ostrzeżenia).
- **DoD:** drzewo czyste lub jawnie wyjaśnione; baseline zapisany.
- **Wycofanie:** brak zmian destrukcyjnych.

#### M0.2 Test przeglądarkowy magazynu w CI
- **Cel:** F-02.
- **Zakres:** dodać `testy/hierarchiaMagazynu.przegladarka.test.mjs` (i później nowe testy magazynowe) do kroku „Testy przeglądarkowe" w `.github/workflows/ci.yml`; sprawdzić stabilność (czas, flaky) na CI; opcjonalnie wydzielić osobny krok.
- **Istniejące:** `skrypty/uruchomTestyPrzegladarkowe.mjs`, `npm run test:magazyn:przegladarka`.
- **Pliki:** `.github/workflows/ci.yml`.
- **Ryzyka:** wydłużenie CI (timeouty 90–120 s/przypadek); niestabilność w headless Chrome na ubuntu.
- **Testy:** uruchomienie workflow na gałęzi PR; 3 kolejne zielone przebiegi.
- **DoD:** krok zielony na CI; opis w `docs/testy-przegladarkowe.md`.
- **Wycofanie:** usunięcie jednej linii workflow.

#### M0.3 Porządek dokumentacji rejestru V4 i wskaźnik planu
- **Zakres:** poprawić nieaktualną linię „V4-19 — przyszłe zadanie" w `docs/v4/rejestr-widokow.md`; dodać odsyłacz do tego planu; odnotować, że `audyt-magazynow-danych.md` dotyczy `3_5`.
- **Testy:** `testy/v4Rejestr.test.mjs`. **DoD:** zielony test rejestru. **Wycofanie:** revert dokumentu.

#### M0.4 Złote fixtury danych magazynowych
- **Cel:** niezmienne dane testowe dla migracji (MAG-15).
- **Zakres:** katalog `testy/fixtury/magazyn/` z kopertami: v1 (minimalna), v2 pusta, v2 z produktami/wariantami/egzemplarzami/ruchami/inwentaryzacją, v2 z `poprzednieKody` (po M2.2), „uszkodzona" (do testów blokady). Helper ładujący do `localStorage` w testach.
- **Testy:** odczyt każdej fixtury → oczekiwany wynik/odrzucenie; zapis→odczyt idempotentny.
- **DoD:** fixtury używane przez M2.x. **Wycofanie:** usunięcie plików.

### FAZA 1 — Kontrakty i decyzje (P0, głównie dokumentacja)

#### M1.1 Pakiet ADR magazynu
- **Zakres:** `docs/magazyn/ADR-magazyn.md` z decyzjami: schemat kodów (DEC-04/22), `SZAFA` (DEC-05), kontrakt QR (DEC-16), integralność księgi i `ksiegaOd` (DEC-18), zapis operacji (DEC-15), uprawnienia (DEC-20), polityka ilości ułamkowych (DEC-17), przechowywanie zdjęć (DEC-19), polityka równoległości przy inwentaryzacji (DEC-21), archiwizacja lokalizacji z zapasem (DEC-23), współdzielenie (DEC-08/24). Każda: stan, opcje, domyślna bezpieczna strategia, konsekwencje alternatyw (patrz §9).
- **Zależności:** F0 (M0.1). **DoD:** każda decyzja ma status „zatwierdzona / domyślna do czasu zatwierdzenia".
- **Wycofanie:** dokument.

### FAZA 2 — Fundament danych (P0)

#### M2.1 Typ `SZAFA` — wdrożenie dwuetapowe (F-05)
- **Cel:** MAG-04.
- **Zakres:** **Etap A (wydanie N):** dodać `SZAFA` do `TypLokalizacjiMagazynowej`/`typyLokalizacji` i do **walidacji odczytu**, ale **nie oferować go w UI zapisu**. **Etap B (wydanie N+1, po zainstalowaniu N wszędzie):** udostępnić `SZAFA` w kreatorze/edytorze. Dodatkowo test dokumentujący zachowanie starego czytnika (błąd odczytu zamiast utraty danych).
- **Istniejące:** `mapaMagazynu.ts` (`typyLokalizacji`), `KreatorLokalizacji.tsx`, `EdytorLokalizacji.tsx`.
- **Ryzyka:** wycofanie aplikacji po etapie B. **Zabezpieczenie:** etap A; backup przed etapem B; komunikat w ustawieniach.
- **Testy:** `hierarchiaMagazynu.test.ts` (typ w v2; v1 bez zmian), odczyt koperty z `SZAFA`; test „stary czytnik" na fixturze.
- **DoD:** `SZ-01` tworzy się w UI po etapie B; istniejące dane bez zmian.
- **Wycofanie:** etap A bezpieczny; etap B — usunięcie z UI (dane z `SZAFA` pozostają czytelne dla N).

#### M2.2 Schemat kodów, aliasy, ochrona przed `/` w kodzie
- **Cel:** MAG-03, MAG-19, F-12, F-16.
- **Zakres:** (1) `poprzednieKody` dopisywane automatycznie przy zmianie kodu/rodzica (adresy całej gałęzi); (2) ostrzeżenie w kreatorze/edytorze, gdy wpisano `/` („separator adresu — wpisz jeden segment"); (3) **ustawienie schematu kodów** w kopercie (`schematKodow`: prefiksy `REG/SZ/PL`, dopełnienie do 2 cyfr), domyślny dla *nowych* półek wg DEC-22; (4) **narzędzie jawnego ujednolicenia** istniejących `POLKA-n → PL-NN` z **raportem „na sucho"**, potwierdzeniem i wpisem w `poprzednieKody` — nigdy automatycznie; (5) wyszukiwanie uwzględnia `poprzednieKody`.
- **Istniejące:** `normalizujKodLokalizacji`, `dodajPolki`, `wyszukajLokalizacje`.
- **Ryzyka:** unieważnienie etykiet; zmiana asercji testów `POLKA-n` (F-12). **Zabezpieczenie:** domyślne zachowanie istniejących danych bez zmian; testy aktualizowane **świadomie**, z opisem w raporcie.
- **Testy:** zmiana kodu → alias; masowe przemianowanie z raportem na sucho (bez zapisu) i po potwierdzeniu; kolizje; `/` w polu; dopełnienie a sortowanie (`PL-02` < `PL-10`).
- **DoD:** adres `MAG/L/REG-02/PL-03` tworzony kreatorem; stare kody odnajdywalne.
- **Wycofanie:** pola opcjonalne zostają nieszkodliwe; ustawienie schematu wraca do domyślnego.

#### M2.3 Księga ruchów i niezmienniki (F-03, F-04)
- **Cel:** MAG-09/10/13 (fundament), MAG-15.
- **Zakres:** rozszerzyć `RuchMagazynowy` (pola addytywne §4.3, `ZWROT` — **dwuetapowo jak M2.1**); wydzielić `logika/ksiegaMagazynowa.ts`: `zastosujRuch(dane, ruch)`, `przeliczStanyZRuchow(dane)`, `sprawdzNiezmienniki(dane)`; w `zapiszLokalizacjeMagazynowe` dodać kontrolę N1–N6 (dla danych legacy — marker `ksiegaOd` i test zgodności na fixturach; rozbieżne dane legacy **nie są blokowane**, są oznaczane i raportowane — DEC-18); `przypiszProduktDoLokalizacji` deleguje do nowej funkcji (zachowanie zewnętrzne bez zmian).
- **Istniejące:** `przypisaniaMagazynowe.ts`, `magazynLokalizacji.ts` (blokada zmiany historii już jest).
- **Ryzyka:** odrzucenie poprawnych starych danych; zmiana semantyki `0`. **Zabezpieczenie:** tryb „tylko raport" najpierw (test na fixturach), blokada dopiero po zatwierdzeniu wyników; brak zapisu podczas odczytu.
- **Testy:** scenariusze SPEC §10 (20+10=30; przesunięcie 7 → 13/17; wydanie 5 → 13/12=25; wydanie 13>12 odrzucone bez częściowej zmiany); próba zmiany `ilosc` bez ruchu → odrzucenie; powtórzenie operacji z tym samym `operacjaId` → brak podwojenia; egzemplarz nigdy w dwóch miejscach; zgodność z wszystkimi fixturami.
- **DoD:** niezmienniki egzekwowane w serwisie; zero regresji w istniejących testach.
- **Wycofanie:** przełącznik trybu kontroli (raport/blokada); dodane pola opcjonalne nieszkodliwe.

#### M2.4 Trwałość: `przestrzenId`, repozytorium, zdjęcia, monitor rozmiaru (F-07)
- **Zakres:** `przestrzenId` generowany przy pierwszym jawnym zapisie (nie przy odczycie); interfejs `RepozytoriumMagazynu` (odczyt/zapis/konflikt) jako szew pod ewentualne B/C — domyślna implementacja = obecny `localStorage`; **monitor rozmiaru** koperty (ostrzeżenie przy zbliżaniu się do limitu); decyzja DEC-19: zdjęcia lokalizacji w **IndexedDB** (jak zdjęcia paczek) z referencją w kopercie — **tylko jeśli** pomiar/ryzyko to uzasadni; wtedy migracja z zachowaniem danych i test backup/restore.
- **Ryzyka:** migracja zdjęć; zgodność backupu E4 (obejmuje IndexedDB). **Zabezpieczenie:** brak zmiany bez DEC-19; test restore.
- **Testy:** odczyt starej koperty bez `przestrzenId` (nie dopisuje się w odczycie); quota → komunikat i brak utraty; backup/restore z kopertą i zdjęciami.
- **DoD:** komunikat „dane lokalne tego urządzenia" w UI; monitor rozmiaru.
- **Wycofanie:** pola opcjonalne.

### FAZA 3 — Katalog artykułów (P0/P1)

#### M3.1 CRUD katalogu: produkty, warianty, egzemplarze
- **Cel:** MAG-02, F-17.
- **Zakres:** widok katalogu (trasa `/zakupy/katalog-produktow`, dziś „w przygotowaniu") korzystający z **tej samej koperty magazynu**; usługa `logika/katalogProduktow.ts` (dodaj/edytuj/dezaktywuj, unikalność nazwy case-insensitive, rodzaj, sposób ewidencji, jednostka, progi, kategoria, SKU); warianty (cechy), egzemplarze (`numerEwidencyjny`, `numerSeryjny`); **brak usuwania** (serwis i tak blokuje) — tylko dezaktywacja; zmiana `sposobEwidencji`/`jednostkaMiary` produktu z istniejącym stanem — **zablokowana** (komunikat).
- **Istniejące:** `Produkt`, `WariantProduktu`, `EgzemplarzProduktu`, walidacja w `normalizujDaneMagazynowe`, tryb edycji i strażnik niezapisanych zmian.
- **Ryzyka:** drugi magazyn produktów (niedozwolone); zmiana jednostki psuje sumy. **Zabezpieczenie:** jedno źródło; blokady.
- **Testy:** domenowe (walidacja, unikalność, blokady), przeglądarkowe (dodanie produktu→wariantu→egzemplarza→przypisanie), restart zachowuje dane.
- **DoD:** pełny katalog edytowalny bez wchodzenia w mapę; rejestr V4 zaktualizowany.
- **Wycofanie:** ukrycie trasy; dane zostają.

#### M3.2 Import katalogu i stanu początkowego (CSV) ze stagingiem
- **Cel:** DEC-11; „użytkownik otrzymuje możliwość importu rzeczywistego katalogu" (SPEC §3.1).
- **Zakres:** adapter CSV → model pośredni → **staging z podglądem różnic i decyzją użytkownika** → centralne zastosowanie przez M3.1/M5.1 (stan początkowy jako `PRZYJECIE` z `przyczyna: 'STAN_POCZATKOWY'`); walidacja deterministyczna, raport błędów po wierszach; brak danych przykładowych w aplikacji.
- **Zależności:** M2.3, M3.1. **Testy:** poprawny/błędny/duplikaty/nieznana lokalizacja/ułamki; ponowny import nie dubluje (`operacjaId` z hash pliku+wiersza). **DoD:** import 200 pozycji bez utraty; powtórka nic nie zmienia. **Wycofanie:** ruchy kompensujące (nie kasowanie).

#### M3.3 Statusy stanu i alarmy (MAG-11)
- **Zakres:** czysta funkcja `ocenStan(wiersz)` → `BRAK_PROGU | ZERO | PONIZEJ_MINIMUM | MIEDZY_MIN_A_CEL | NA_CELU_LUB_WYZEJ | DO_PRZELICZENIA`; w UI: ikona + tekst + kolor; uzgodnić miarkę (0 z celem = „neutralny" dziś; jednoznaczny komunikat), minimum względem segmentów; **zachować** istniejące filtry/semantykę `Do zamówienia`.
- **Testy:** tabela przypadków (0, min, cel, brak progów, cel < min, wariant bez progu). **DoD:** brak sprzeczności między filtrem a kolorem. **Wycofanie:** revert komponentu.

### FAZA 4 — Mapa 2D i nawigacja kodowa (P0/P1)

#### M4.1 Kompaktowe kafelki i okruszki oparte na kodach (GAP-06)
- **Cel:** MAG-03/20.
- **Zakres:** kafelek: **duży kod** + licznik/ikona problemu; `title`/`aria-label` z pełną nazwą i adresem; okruszki z kodami (`MAG › L › REG-02 › PL-03`); drzewo: kod główny, nazwa drugorzędna; bez zawijania kodów; tekst nigdy nie wychodzi poza kafelek (`overflow`, `text-overflow`).
- **Istniejące:** `PlanMagazynu.tsx`, `WidokMapyMagazynu.tsx` (okruszki), `mapaMagazynu.css`, `DrzewoLokalizacji.tsx`. Opiera się na zatwierdzonej nawigacji (M0.1).
- **Ryzyka:** utrata informacji (nazwa) → dostępna w szczegółach. Brak zmiany modelu.
- **Testy:** przeglądarkowy snapshot szerokości 390/768/1024/1440/1920 (brak poziomego przewijania strony, brak nakładania); `aria-label`; istniejące testy mapy.
- **DoD:** kafelek bez drugiej linii nazwy; okruszki kodami; test zielony w CI.
- **Wycofanie:** revert CSS/komponentów.

#### M4.2 Widok mebla (półki) niezależny od geometrii
- **Cel:** MAG-06.
- **Zakres:** komponent `WidokMebla.tsx` + logika `logika/widokMebla.ts`: półki jako pionowa lista wg `kolejnosc` i kierunku (DEC-03), przy każdej: kod, liczba produktów/pozycji, znacznik problemu, zaznaczenie; kliknięcie → zawartość + historia ruchów tej półki. Dostępny z REGAL i SZAFA.
- **Istniejące:** `pobierzProblemyLokalizacji`, `zawartosc` w szczegółach.
- **Testy:** kolejność i kierunek numeracji; półka bez geometrii widoczna; dostępność klawiaturą.
- **DoD:** regał z 5 półkami (kreator) wyświetla `PL-01…05` w ustalonym kierunku bez dodawania geometrii.
- **Wycofanie:** ukrycie widoku.

#### M4.3 Edytor planu pomieszczenia: legenda, orientacja, ostrzeżenia
- **Zakres:** opcjonalne `widokPlanu` (orientacja „od wejścia" — DEC-02; legenda L/P/S), ostrzeżenie o nakładaniu prostokątów (nie blokada), wyśrodkowanie/dopasowanie do widoku, „Zapisz/Odrzuć" zgodnie ze strażnikiem; **start z pustego planu** — brak generowania układu (F-15). Wprowadzenie realnego układu przez użytkownika po dostarczeniu pomiarów/zdjęć (DEC-01).
- **Testy:** ostrzeżenie o nakładaniu; granice 0–100; zachowanie zapisanych współrzędnych; brak automatycznych elementów.
- **DoD:** użytkownik buduje własny plan od zera. **Wycofanie:** pola opcjonalne.

#### M4.4 Wyszukiwanie produktu → krótkie adresy
- **Zakres:** wyniki jako lista `PL-03 (MAG/L/REG-02) — 12 ryz` z kliknięciem do lokalizacji; wyszukiwanie po nazwie, SKU, wariancie, starym kodzie; podświetlenie na planie i w drzewie; suma bez podwójnego liczenia wariantów.
- **Testy:** przypadek 12+18+40=70 (istniejący) + warianty. **DoD:** brak podwójnego sumowania. **Wycofanie:** revert.

#### M4.5 Dostępność i responsywność mapy (F-13, F-14)
- **Zakres:** przywrócić **widoczny przycisk „Wejdź/Otwórz plan"** (nie tylko dwuklik) i równoważną akcję klawiaturą bez wymagania uprzedniego zaznaczenia; obsługa dotyku (cel ≥ 44 px); alternatywa dla przeciągania (pola liczbowe — już są); pomiar kosztu `pobierzProblemyLokalizacji` per kafelek i ewentualna memoizacja (jedno wyliczenie `wyliczStanyMagazynowe` na render); test przeglądarkowy macierzy szerokości + klawiatura.
- **Testy:** nawigacja klawiaturą (Tab/Enter/strzałki), czytnik (role/aria), brak poziomego scrolla; benchmark 300 półek × 200 produktów.
- **DoD:** wszystkie akcje dostępne bez dwuklika; czas renderu zmierzony i udokumentowany.

### FAZA 5 — Operacje magazynowe (P1)

#### M5.1 Silnik operacji
- **Cel:** MAG-08/09.
- **Zakres:** `logika/operacjeMagazynowe.ts`: `przyjmij`, `wydaj`, `przesun`, `zwroc`, `popraw` — czyste funkcje (`dane → dane'`), każda z walidacją (dodatnia ilość, aktywna gałąź lokalizacji, nieujemny wynik, jednostka, egzemplarz max w 1 miejscu), `operacjaId` dla idempotencji, atomowo (jeden wynik albo błąd bez zmiany); polityka ilości ułamkowych per jednostka (DEC-17).
- **Zależności:** M2.3. **Testy:** komplet scenariuszy SPEC §10 + brzegi (0, ułamki, nieaktywna lokalizacja, zwrot ponad wydanie, podwójny `operacjaId`). **DoD:** 100% scenariuszy §10 zautomatyzowane. **Wycofanie:** moduł nieużywany przez UI do czasu M5.2.

#### M5.2 UI operacji i zapis natychmiastowy (F-11)
- **Zakres:** `uslugi/zapiszOperacjeMagazynowe` (read-fresh → re-walidacja → append → jeden `setItem`; konflikt → ponowienie względem świeżego stanu, a gdy operacja przestała być możliwa — czytelny błąd); panel „Operacja" w szczegółach lokalizacji (Przyjmij/Wydaj/Przenieś/Zwróć/Popraw) z potwierdzeniem; tryb oddzielony od „Edytuj plan"; po zapisie odświeżenie projekcji; błędy/quota widoczne wprost.
- **Istniejące:** `FormularzPrzypisania` (przyjęcie/przesunięcie w trybie edycji) — zachować do czasu migracji wywołań; strażnik niezapisanych zmian.
- **Ryzyka:** dwa ścieżki zapisu (konfiguracja vs operacje) mogą się rozjechać. **Zabezpieczenie:** obie przez to samo repozytorium (M2.4) i te same niezmienniki (M2.3).
- **Testy:** przeglądarkowe: wydanie 5 z `PL-02` → 13/12=25; wydanie ponad stan odrzucone; operacja przy zmienionym stanie w drugim oknie; offline/quota → brak pozornego sukcesu.
- **DoD:** wydanie możliwe bez wchodzenia w „Edytuj plan".

#### M5.3 Historia i raporty
- **Zakres:** widok ledgera z filtrami (produkt, lokalizacja, rodzaj, osoba, data), eksport CSV; korekta wyłącznie nowym ruchem; wyświetlanie krótkich adresów.
- **Testy:** filtry; eksport (kolumny, znaki PL, ułamki). **DoD:** historia bez ograniczenia 100% zapisów.

#### M5.4 Uprawnienia i ślad audytowy (MAG-13)
- **Zakres:** funkcje z §4.8 w `uprawnienia.ts`; użycie w usługach (nie tylko w UI) i w UI (widoczność ≠ egzekwowanie — AGENTS.md); pola audytowe w ruchu (`wykonanePrzezId`, czas, przyczyna); komunikaty odmowy.
- **Testy:** macierz rola×operacja (jak `programyUprawnienia.regresja.test.ts` jako wzorzec); odmowa bez uprawnień; brak wpływu na istniejące konta. **DoD:** każda operacja stanowa ma test uprawnień.

### FAZA 6 — Inwentaryzacja (P1)

#### M6.1 Model i silnik inwentaryzacji
- **Zakres:** statusy `ROBOCZA → W_TRAKCIE → DO_ZATWIERDZENIA → ZAMKNIETA (+ANULOWANA)` (**dwuetapowo — F-05**); utworzenie z **snapshotem** (zakres: obiekt/strefa/regał/półki — poddrzewo), pozycje `iloscOczekiwana`; wpisanie `iloscStwierdzona` (brak wpisu ≠ zero); zamknięcie generuje `KOREKTA` z `pozycjaInwentaryzacjiId` (pole już istnieje w ruchu) **idempotentnie** (N5); polityka równoległości (DEC-21): domyślnie ruchy w trakcie spisu dozwolone i uwzględniane przy zamknięciu (`różnica = policzone − (oczekiwane + Δ ruchów od snapshotu)`), z flagą.
- **Zależności:** M5.1. **Testy:** ponowne zamknięcie bez efektu; spis częściowy; różnice dodatnie/ujemne; ruch w trakcie spisu; `czyDoPrzeliczenia` nadal poprawne. **DoD:** scenariusz SPEC §10 „ponowne wykonanie nie księguje ponownie".

#### M6.2 UI liczenia i lista do wydruku
- **Zakres:** widok mobilny (duże pola, jedna półka naraz), lista do liczenia na wydruk, ręczne wprowadzanie; ostrzeżenie o nieprzeliczonych pozycjach; zatwierdzenie wymaga `czyMozeZatwierdzacInwentaryzacje`. Skan QR półki (po F7) tylko **otwiera spis tej półki**.
- **Testy:** przeglądarkowe 390 px; zachowanie wpisów przy odświeżeniu (ochrona niezapisanych zmian). **DoD:** spis jednej półki od początku do zamknięcia w < 10 kliknięć.

### FAZA 7 — QR i etykiety półek (P1)

#### M7.0 Spike platform: kamera i dekodowanie (równolegle od F0)
- **Cel:** F-08; decyzja co jest wykonalne na Windows (WebView2), Androidzie (WebView/Tauri), PWA/Web, Raspberry Pi.
- **Zakres:** sprawdzić `getUserMedia` w kontekście Tauri (czy potrzebne uprawnienia w `src-tauri/gen/android` / capabilities), dostępność `BarcodeDetector` (wsparcie zależy od platformy — **nie zakładać**), wybór dekodera JS (licencja, rozmiar bundla, wydajność; wymóg AGENTS.md: uzasadniona zależność, bez telemetrii), czytnik klawiaturowy (bufor znaków + prefiks/Enter). Wynik: raport + rekomendacja; **bez** kodu produkcyjnego.
- **DoD:** tabela „platforma × metoda skanu × status".

#### M7.1 Kontrakt i parser payloadu QR
- **Zakres:** `logika/kodQrLokalizacji.ts`: `zbudujPayload`, `sparsujPayload` → wynik tagowany (`OK | ZLA_WERSJA | OBCA_PRZESTRZEN | NIEPOPRAWNY | PUSTY`), limit długości ≤ możliwości kodera; lokalizacja po `id` (nie po kodzie); komunikaty błędów po polsku.
- **Testy:** komplet przypadków brzegowych (§4.6); fuzz prostych uszkodzeń; nieznane/nieaktywne ID; zmieniony kod. **DoD:** parser odporny na dowolny ciąg.

#### M7.2 Współdzielony renderer QR + test okrągły
- **Zakres:** wydzielić koder do `src/wspolne/` z re-eksportem (zero zmian dla paczek); **test złoty macierzy** (identyczność przed/po); test okrągły zakodowanie→**dekodowanie** (dekoder tylko w `devDependencies`, o ile licencja pozwala); rozważyć potrzebę rozszerzenia kodera (wersje/korekcja) tylko gdy payload tego wymaga.
- **Ryzyka:** regresja etykiet paczek. **Zabezpieczenie:** test złoty + `checklistaPaczki.regresja.test.ts` + `checklistyPaczek.przegladarka.test.mjs`.

#### M7.3 Etykiety półek: szablony, druk, dziennik wydruków
- **Zakres:** nowa domena (osobna od paczek): etykieta = **duży skrócony adres** + QR + opcjonalny opis; szablony: pojedyncza i zbiorcza A4 (siatka), druk przez istniejący mechanizm PDF/druku (wzór: `PanelEtykietPaczek`), quiet zone, skala 100%; wydruk zbiorczy dla regału/strefy; **dziennik wydruków** (`wydrukiEtykiet`: `locId`, `pelnyKodWDruku`, data, autor) → przy skanie wykrycie „etykieta ze starym kodem" i oferta ponownego wydruku; wyraźna odmienność wizualna od etykiety paczki.
- **Zależności:** M2.2, M2.4, M7.1, M7.2. **Testy:** render macierzy, zgodność payloadu, dziennik; test wydruku PDF (tam, gdzie runner pozwala); ręczny odbiór fizyczny (M7.6). **DoD:** wydruk zbiorczy dla regału, dziennik zapisany.

#### M7.4 Skaner i route „Skanuj QR"
- **Zakres:** widok `Magazyn → Skanuj QR`; trzy tryby: kamera (wg M7.0), czytnik klawiaturowy, ręczne wpisanie kodu/adresu; wynik parsera → karta lokalizacji (adres, zawartość, plan/mebel); błędy czytelne (nieznany, obca instalacja, uszkodzony, nieaktywna lokalizacja, brak uprawnień); **skan nie księguje** nic; rejestr widoku V4.
- **Testy:** symulowane wejście czytnika; parser w UI; przeglądarkowe z wstrzykniętym ciągiem. **DoD:** każdy typ błędu ma test i komunikat.

#### M7.5 Szybkie akcje z karty lokalizacji
- **Zakres:** „Przyjmij/Wydaj/Przenieś/Policz" z karty (używa M5.1/M5.2/M6); uprawnienia sprawdzane w usłudze; potwierdzenie przed zapisem.
- **Testy:** akcja bez uprawnień odrzucona; po zapisie nowy stan widoczny. **DoD:** skan → wydanie w ≤ 4 krokach.

#### M7.6 Odbiór fizyczny (checklista)
- **Zakres:** arkusz testowy: wydruk 10 etykiet na dostępnej drukarce/papierze, odczyt na ≥ 2 niezależnych telefonach i czytniku, różne światła/odległości, uszkodzona etykieta; wynik w raporcie. (Wymóg z `e4-uruchomienie.md`: produkcyjne QR wymagają odbioru na dwóch niezależnych urządzeniach.)

### FAZA 8 — Integracje, backup, raporty (P1/P2)

#### M8.1 Niski stan → zapotrzebowanie (Pulpit jako jedyne źródło zapotrzebowań)
- **Zakres:** widoczny przycisk „Zgłoś zapotrzebowanie" przy pozycji poniżej minimum; zapis **przez istniejący** `magazynPulpitu` (nie nowy magazyn); opcjonalne pola `produktId`/`wariantProduktuId`/`zrodlo: 'MAGAZYN'` w `ZapotrzebowanieZakupowe` (normalizacja starych rekordów — AGENTS.md); **ochrona przed duplikatem** (jest aktywne zgłoszenie dla produktu → pokaż je); proponowana ilość = dopełnienie do celu (bez niejawnych rezerwacji).
- **Ryzyka:** podwojenie zgłoszeń; zmiana modelu Pulpitu (backup/test normalizacji). **Testy:** rekord bez nowych pól odczytywany jak dotąd; duplikat; brak automatycznego tworzenia.
- **DoD:** zgłoszenie z magazynu widoczne w Pulpicie i w ZAKUPACH, jedno na produkt.

#### M8.2 Przyjęcie dostawy (zamówienia) — **P2, zależne od rozwoju ZAKUPÓW**
- Powiązanie przyjęcia z `PozycjaPrzesylki`/zamówieniem i częściową dostawą; pozostaje poza pierwszymi wdrożeniami (GAP-05). Zależność: istnienie trwałych zamówień.

#### M8.3 Wydanie do paczki/szkolenia — **P2, DEC-09**
- Tylko projekt: jawne zatwierdzenie, odwracalność, brak odpisu przy samym wydruku checklisty/etykiety. Nie implementować bez osobnej zgody.

#### M8.4 Backup, restore, eksporty
- **Zakres:** testy: kopia `WSZYSTKO` zawiera kopertę magazynu (i zdjęcia, jeśli DEC-19 → IndexedDB); przywrócenie na czystym profilu odtwarza plan, stany, ruchy, wydruki etykiet; eksport CSV/XLSX/PDF stanów i historii (priorytet wg potrzeb).
- **Testy:** rozszerzyć `backupMigracjaRestore.test.ts` i `backupMigracjiE4.przegladarka.test.mjs` o magazyn. **DoD:** restore na czystym profilu daje identyczny stan (hash).

#### M8.5 Dokumentacja i CI jako zadanie ciągłe
- Aktualizacja: `docs/v4/*`, raportów w `docs/audyty/`, `docs/testy-przegladarkowe.md`, `ci.yml` (nowe testy przeglądarkowe), instrukcja użytkownika (etykiety, numeracja, skanowanie).

### FAZA 9 — Współdzielenie danych (ADR-bramka)

#### M9.1 ADR „wspólny stan magazynu"
- **Zakres:** decyzja A/B/C (§4.5) z konsekwencjami; lista zależności E4 (API z autoryzacją rekordów, adaptery Windows/Android/Web, kolejka zmian, reguły domenowe po stronie serwera); rodzaje rekordów magazynowych w `magazynSqlite.mjs` (`MAGAZYN_*`) — projekt; model konfliktów dla ruchów (idempotentne `operacjaId`).
- **DoD:** zatwierdzony ADR. **Implementacja B/C — osobny program po akceptacji E4**, poza tym planem.

### FAZA 10 — Palety (ODŁOŻONE, P2+)

- **Rezerwacja punktów rozszerzalności (bez implementacji):** typy lokalizacji jako jeden rejestr (`typyLokalizacji`) z dwuetapowym wdrażaniem nowych wartości (F-05); QR i ledger niezależne od typu; widok planu podłogi pozwala na obiekty bez półek. Przykładowe adresy `MAG/S/PAL-RZ-01/PAL-01` — **niezatwierdzone**.
- **Warunki startu:** ukończone F2–F7 dla regałów/szaf/półek; pomiary środkowej strefy; DEC-13.

---

## 7. Macierz śledzenia wymagań

| ID | Faza | Zadania | Zestaw testów | Uwagi |
|---|---|---|---|---|
| MAG-01 | F0 | M0.1, ten dokument | baseline `npm test/lint/build` | powtarzać „deltę" przed fazą |
| MAG-02 | F3 | M3.1, M3.2, M2.4 | `katalogProduktow.test.ts`, import CSV, przeglądarkowy katalog | DEC-10/11 |
| MAG-03 | F2, F4 | M2.2, M4.1 | kody/aliasy, widok kodowy 5 szerokości | GAP-06/08, F-12/16 |
| MAG-04 | F2 | M2.1 | typ `SZAFA` + „stary czytnik" | dwuetapowo (F-05) |
| MAG-05 | F4 | M4.3 | plan od zera, ostrzeżenie o nakładaniu | DEC-01/02 |
| MAG-06 | F4 | M4.2 | widok mebla, kierunek numeracji | DEC-03 |
| MAG-07 | F4 | M4.4 | 12+18+40=70, warianty | — |
| MAG-08 | F5 | M5.1, M5.2 | scenariusze §10 | zachować obecne przepływy |
| MAG-09 | F2, F5 | M2.3, M5.1–M5.3 | wydanie/zwrot/korekta, niezmienniki | ZWROT dwuetapowo |
| MAG-10 | F6 | M6.1, M6.2 | idempotencja zamknięcia, spis częściowy | DEC-21 |
| MAG-11 | F3, F8 | M3.3, M8.1 | tabela statusów, duplikaty zgłoszeń | Pulpit jedyne źródło |
| MAG-12 | F7 | M7.0–M7.6 | parser, test złoty/okrągły, skaner, odbiór fizyczny | DEC-06/16 |
| MAG-13 | F2, F5 | M5.4, M2.3 | macierz rola×operacja, ślad audytowy | client-side (jawnie) |
| MAG-14 | F8 | M8.1 (P1); M8.2, M8.3 (P2) | integracja Pulpit; reszta po decyzjach | DEC-09 |
| MAG-15 | F0, F2, F8 | M0.4, M2.1–M2.4, M8.4 | fixtury, migracja idempotentna, restore z magazynem | — |
| MAG-16 | F0, F7, F8 | M0.2, M7.0, M7.6, M4.5 | CI magazynu, macierz platform | Android/WebView do spike'u |
| MAG-17 | F10 | rezerwacje w M2.1/M7.x | — (odłożone) | DEC-13 |
| MAG-18 | F9 | M9.1 (+M2.4 szew) | — (decyzja) | nie obiecywać |
| MAG-19 | F2, F7 | M2.2, M7.3, M7.4 | dziennik wydruków, stary kod, uszkodzony QR | — |
| MAG-20 | F4 | M4.1, M4.5 | 390–1920 px, klawiatura, benchmark | — |

### 7.1. Kontrola kompletności ponad listą z promptu

| Obszar | Gdzie ujęty |
|---|---|
| Migracje i zachowanie danych | M0.4, M2.1–M2.4, M3.2, M8.4; zasada „addytywnie w v2" (F-06), dwuetapowe enumeracje (F-05), brak automatycznych przemianowań |
| Windows / Android / PWA / RPi | M7.0 (spike), M7.6, macierz w §9.3; „nie zakładać identycznego zachowania" |
| Dostępność i responsywność | M4.1, M4.5, M6.2, wymagania w każdym DoD |
| Zgodność z nawigacją i systemem wizualnym | rejestr V4 (M0.3, każdy nowy widok), użycie `--ui-*`/istniejących komponentów, `zakupy__nawigacja` |
| Ochrona niezapisanych zmian | M5.2 (tryb operacji z natychmiastowym zapisem), strażnik w edycji planu, M6.2 |
| Uprawnienia | M5.4, §4.8, ADR |
| Błędy skanowania i druku | M7.1, M7.3, M7.4, M7.6 |
| Konflikty zapisu, backup | M2.4, M5.2 (re-walidacja), M8.4, M9.1 |
| Dokumentacja, testy, CI | M0.2, M0.3, M8.5, raport po każdym zadaniu |

### 7.2. Luki wykryte audytem i dopisane do planu (spoza listy MAG)

F-02 (CI), F-03 (niezmiennik księgi), F-05 (zgodność wstecz enumeracji), F-07 (rozmiar `localStorage`/zdjęcia), F-08 (URL w QR zależny od originu), F-11 (tryb operacji), F-14 (dostępność dwuklika), F-16 (sortowanie kodów), pułapka `/` w kodzie, koszt `pobierzProblemyLokalizacji`, duplikaty zgłoszeń zapotrzebowań, dziennik wydruków etykiet, nieaktualna linia rejestru V4, baza robocza z WIP (F-01), polityka archiwizacji lokalizacji z zapasem (DEC-23).

---

## 8. Odpowiedzi końcowe (A–E)

### A. Co działa i nie wymaga przebudowy
- Hierarchia lokalizacji ze stabilnymi ID, walidacją cykli/kolizji, wyliczanym `pelnyKod`.
- Atomowy zapis, blokady usuwania i zmiany tożsamości, ochrona historii ruchów, migracja v1→v2 z `zapisPrzedMigracja`, wykrywanie konfliktu między oknami.
- Plan 2D (zoom, siatka, przeciąganie, skalowanie, klawiatura), drzewo, kreator, duplikowanie, kolejność.
- Agregacja stanów (bez podwójnego sumowania), miarka, filtry, „Gdzie to leży?".
- Przyjęcie i przesunięcie z historią; uprawnienie edycji; backup `WSZYSTKO`; strażnik niezapisanych zmian.
- Dedykowane testy domenowe i przeglądarkowe (poza CI — F-02).

### B. Poprawić/uzupełnić w pierwszej kolejności
1. Uporządkować bazę roboczą i zatwierdzić WIP nawigacji mapy (M0.1), dodać test magazynu do CI (M0.2).
2. Kody zamiast nazw w kafelkach i okruszkach + dostępne „Wejdź" (M4.1, M4.5).
3. Niezmiennik „zmiana ilości ⇒ ruch" i rozszerzony model ruchu (M2.3).
4. Fixtury migracyjne i sekwencja wydań dla nowych enumeracji (M0.4, M2.1).
5. Spike QR/kamera, żeby nie zbudować etykiet, których nie da się odczytać (M7.0).

### C. Zadania równoległe
- Po M0.1: **M0.2 ‖ M0.3 ‖ M0.4 ‖ M1.1 ‖ M7.0 ‖ M4.1** (rozłączne pliki/obszary; M4.1 dotyka komponentów mapy, M1.1/M7.0 to dokumenty).
- Po M2.3: **M3.1 ‖ M5.1** (katalog vs silnik operacji); **M4.2 ‖ M4.3 ‖ M4.4** po M2.2.
- **M7.1 ‖ M7.2** (po ADR-16) niezależnie od F5/F6.
- **Nie równolegle:** dwie zmiany `WidokMapyMagazynu.tsx` / `magazynLokalizacji.ts` (wspólne pliki); zadania zmieniające koperty (M2.x) po kolei.

### D. Świadomie odkładamy
- Palety i dwa rzędy w środkowej strefie (F10, MAG-17).
- Wspólny stan zespołu / synchronizacja (implementacja B/C) — tylko ADR (M9.1).
- Przyjęcie dostawy z zamówień (M8.2) i wydanie do paczki (M8.3).
- Rezerwacje, stan „zamówiony/w drodze", przeliczniki opakowań (DEC-10), „pokaż drogę".
- Nowa odznaka `MAGAZYNIER` w kartotece kont; URL-owa wersja QR (wymaga publicznego originu).

### E. Pierwszy samodzielny etap implementacyjny — **E1**
**Zakres:** M0.1 (po decyzji użytkownika) + M0.2 + M0.3 + M4.1 (+ dostępny przycisk „Wejdź" z M4.5).
**Dlaczego ten:** nie zmienia modelu danych ani formatu zapisu (zero ryzyka migracyjnego), daje od razu widoczny efekt zgodny z celem (kody zamiast długich nazw), domyka dziurę CI i dostarcza zmierzony baseline pod kolejne fazy.
**Warunki wejścia:** decyzja co zrobić z niezatwierdzonymi zmianami i z gałęzią bazową (DEC-14).
**Kryteria odbioru:** `npm test`, `npm run lint`, `npm run build`, `git diff --check` zielone; test przeglądarkowy magazynu zielony **w CI**; zrzuty 390/768/1024/1440/1920 bez poziomego przewijania i nakładania tekstu; akcje mapy dostępne bez dwuklika; brak zmian w `modele/zakupy.ts` i `magazynLokalizacji.ts`.
**Wycofanie:** revert PR; brak wpływu na dane.
**Równolegle z E1 (dokumenty, bez kodu):** M1.1 (ADR), M7.0 (spike), M0.4 (fixtury — tylko pliki testowe).

---

## 9. Rejestr decyzji i ryzyk

### 9.1. Rejestr decyzji

Z dokumentu wejściowego: DEC-01…13; nowe: DEC-14…24. Przy braku decyzji obowiązuje **domyślna bezpieczna strategia**.

| ID | Decyzja | Domyślna strategia do czasu zatwierdzenia | Skutek alternatywy |
|---|---|---|---|
| DEC-01 | Fizyczny układ (liczba regałów/szaf/półek, wymiary) | Edytor i pusty plan; brak generowanych danych | Dane z pomiarów/zdjęć dopiero po dostarczeniu |
| DEC-02 | Punkt odniesienia L/P/S | „Patrząc od wejścia", zapisane w legendzie planu (`widokPlanu`) | Inny punkt = zmiana legendy, bez migracji kodów |
| DEC-03 | Kierunek numeracji półek | Ustawienie w kopercie; domyślnie od dołu do góry; widoczne na etykiecie/instrukcji | Zmiana kierunku = zmiana tylko widoku (`kolejnosc` stałe) |
| DEC-04 | `SZ` vs `SZAF` | `SZ` | Inny skrót = tylko preset schematu kodów |
| DEC-05 | `SZAFA` jako typ vs podtyp | Osobny typ `SZAFA` wdrażany dwuetapowo (F-05) | Podtyp = brak zmiany enumeracji, ale gorsza semantyka |
| DEC-06 | Model QR | `UP-MAG:1:<przestrzenId>:<lokalizacjaId>` (opaque) | URL wymaga publicznego originu |
| DEC-07 | Naklejki/drukarka | Neutralny druk A4, formaty termiczne później | Dedykowana etykieciarka po poznaniu sprzętu |
| DEC-08 | Wspólne stany wielu urządzeń | Lokalny wariant A + komunikat w UI | Wariant B/C = osobny program (M9.1) |
| DEC-09 | Wydanie powiązane z paczką | Oddzielny proces z jawnym zatwierdzeniem | Auto-odpis = ryzyko niejawnych zmian stanu |
| DEC-10 | Jednostki i przeliczniki | Brak przeliczania; opis opakowania informacyjny | Przeliczniki = osobne zadanie z testami |
| DEC-11 | Stan początkowy | Import/spis startowy jako `PRZYJECIE` z `STAN_POCZATKOWY` | Wpis „z ręki" = brak śladu |
| DEC-12 | Kto zatwierdza korekty/spisy | `czyMozeAkceptowac` | Szersza grupa = mniej kontroli |
| DEC-13 | Palety | Backlog P2+ | — |
| **DEC-14** | Baza robocza/WIP | Nie mieszać cudzych zmian; osobny PR dla nawigacji mapy | Wspólny commit = ryzyko regresji niepowiązanych widoków |
| **DEC-15** | Operacje: zapis natychmiastowy vs „Zapisz konfigurację" | Natychmiastowy, append-only, z re-walidacją (M5.2) | Staging = niewygodne i podatne na utratę |
| **DEC-16** | QR: opaque vs URL | Opaque (parser w aplikacji) | Patrz DEC-06 |
| **DEC-17** | Ilości ułamkowe | Dozwolone tylko dla jednostek oznaczonych jako ciągłe; domyślnie całkowite | Ułamki wszędzie = błędy zaokrągleń |
| **DEC-18** | Integralność księgi dla danych legacy | Marker `ksiegaOd`; legacy raportowane, nie blokowane | Blokada = ryzyko odrzucenia poprawnych danych |
| **DEC-19** | Zdjęcia lokalizacji | Zostają w kopercie do czasu pomiaru; przeniesienie do IndexedDB tylko gdy ryzyko quota potwierdzone | Wcześniejsza migracja = koszt i ryzyko |
| **DEC-20** | Uprawnienia magazynowe | Funkcje w `uprawnienia.ts` na istniejących rolach/odznakach | Nowa odznaka = migracja kont (Rust) |
| **DEC-21** | Ruchy podczas inwentaryzacji | Dozwolone, uwzględniane przy zamknięciu (rebase) | Blokada lokalizacji = pewniej, ale utrudnia pracę |
| **DEC-22** | Domyślny schemat kodów nowych półek | Dla istniejących danych bez zmian; dla nowych: `PL-NN` po zatwierdzeniu | Utrzymanie `POLKA-n` = brak spójności z etykietami |
| **DEC-23** | Lokalizacja z zapasem: dezaktywacja/archiwizacja | Dezaktywacja zablokowana, dopóki jest zapas > 0 lub wymagane wskazanie przeniesienia | Cicha dezaktywacja = „zapas w nieaktywnym miejscu" |
| **DEC-24** | Granice dostępu do danych magazynu na urządzeniach współdzielonych | Opisać ograniczenie (dane przypisane do profilu przeglądarki — E4) | Izolacja = wariant B |

### 9.2. Rejestr ryzyk

| Ryzyko | Prawdopodobieństwo | Wpływ | Środek zaradczy |
|---|---|---|---|
| Wciągnięcie obcych zmian z WIP | średnie | wysoki | M0.1, osobne PR-y, stagowanie tylko wskazanych plików |
| Wycofanie aplikacji po zapisie nowych enumeracji | niskie | średni (degradacja, nie utrata) | Wdrożenie dwuetapowe (M2.1/M2.3/M6.1), backup przed etapem B |
| Quota `localStorage` (zdjęcia + ruchy) | średnie | wysoki | M2.4 monitor + DEC-19 |
| Rozbieżność stany↔ruchy (F-03) | niskie dziś, rośnie z funkcjami | wysoki | M2.3 przed M5 |
| Nieczytelne etykiety/QR po wydruku | średnie | średni | M7.2 test okrągły, M7.6 odbiór fizyczny, dziennik wydruków |
| Błędna obietnica „wspólnego stanu" | średnie | wysoki | Komunikat w UI, DEC-08, M9.1 |
| Regresja etykiet paczek przy wydzieleniu kodera | niskie | wysoki | Test złoty macierzy + testy paczek |
| Regresja dostępności po WIP (dwuklik) | średnie | średni | M4.5 |
| Wydajność planu przy dużych danych | niskie/nieznane | średni | Pomiar w M4.5 |
| Pułapka `/` w kodzie → błędne adresy | średnie | niski | M2.2 ostrzeżenie |

### 9.3. Macierz platform (do uzupełnienia w M7.0/M7.6)

| Funkcja | Windows (Tauri/WebView2) | Android (Tauri) | PWA/Web (HTTPS) | Raspberry Pi |
|---|---|---|---|---|
| Plan/mapa/operacje | [NIEZWERYFIKOWANE w tej sesji] — wymagane testy w `desktop-windows.yml`/odbiorze | wymaga odbioru | wymaga odbioru | wg wsparcia repo |
| Skan kamerą | do spike'u | do spike'u (uprawnienia) | do spike'u (kontekst bezpieczny) | do spike'u |
| Czytnik klawiaturowy | prawdopodobnie bez zmian | zależne od klawiatury BT | tak | tak |
| Druk etykiet A4/PDF | istniejący mechanizm paczek | do sprawdzenia | `window.print`/PDF | do sprawdzenia |

---

## 10. Plan testów (zbiorczo)

- **Jednostkowe (domena):** `ksiegaMagazynowa`, `operacjeMagazynowe`, `katalogProduktow`, `kodQrLokalizacji`, `statusStanu`, `widokMebla`, kody/aliasy; scenariusze liczbowe SPEC §10 jako jawne przypadki.
- **Integracyjne (persistence):** `zapiszLokalizacjeMagazynowe`/`zapiszOperacjeMagazynowe` na fixturach `testy/fixtury/magazyn/`; konflikt dwóch okien; quota; migracje idempotentne; „stary czytnik" na nowych enumeracjach; uprawnienia w serwisie.
- **Interfejs (przeglądarka, w CI po M0.2):** przepływy: katalog→przyjęcie→przesunięcie→wydanie→spis; kody w kafelkach; plan od zera; widok mebla; skan (wstrzyknięty ciąg); klawiatura; szerokości 390/768/1024/1440/1920.
- **Regresyjne:** zachowanie istniejących asercji (nie osłabiać); etykiety paczek; Pulpit/zapotrzebowania; backup/restore.
- **Dostępność:** role/aria, fokus, kontrast, tryb dotykowy (rozmiary celów), brak funkcji tylko-dwuklikowych.
- **Platformowe/manualne:** odbiór fizyczny QR na ≥ 2 urządzeniach, druk na dostępnym sprzęcie, Android.
- **CI:** dodać nowe testy do `ci.yml`; `npm test` ma zawierać każdy nowy `*.test.ts`.

## 11. Kolejność PR-ów (małe, odwracalne)

1. PR-0a: porządek bazy/nawigacja mapy (decyzja M0.1). 2. PR-0b: CI + rejestr V4 + fixtury (M0.2–M0.4). 3. PR-1: M4.1/M4.5 (UI kody + dostępność). 4. PR-2: ADR (M1.1) — docs. 5. PR-3: M2.1 etap A, 6. PR-4: M2.2, 7. PR-5: M2.3 (tryb raport→blokada w osobnych PR), 8. PR-6: M2.4, 9. PR-7: M3.1, 10. PR-8: M5.1, 11. PR-9: M5.2–M5.4, … dalej wg grafu §5. Żadnego PR-a nie łączyć „przy okazji" z refaktorem; każdy ma raport w `docs/audyty/`.

---

*Koniec dokumentu. Stan na 2026-11-19; weryfikacja statyczna (bez uruchamiania testów i aplikacji); przed każdą fazą powtórzyć krótki audyt „delty" względem aktualnego HEAD (MAG-01).*
