# Etykiety paczek 2.0 — implementacja adaptacyjna

Realizacja: 23 listopada 2026. Data w nazwie pliku odpowiada specyfikacji użytkownika.

## Stan wejściowy

- Repozytorium: `C:/Users/madej/Documents/____GitHub_Projects/___Projekty_GitHub/Ultimate_Pomagier_4_aktualny`.
- Origin: `https://github.com/kapi1944/Ultimate_Pomagier.git`.
- Gałąź: `perf/rerendery-kontekst`.
- HEAD: `a0f741a7f306907cd8df8f5dfbb6b838a7923e42` (`Scal main do perf/rerendery-kontekst`). Lokalna referencja `origin/perf/rerendery-kontekst` była identyczna. Nie sprawdzano serwera GitHub i nie wykonywano fetch.
- Czysty working tree; wejściowy `git diff --check` bez błędów. Odczytano `AGENTS.md`, polecone raporty checklist z października i listopada oraz audyty systemu dokumentów i magazynów.
- Bez internetu, instalacji zależności, podagentów, zmiany gałęzi, worktree, commita, pushu i publikacji. Nie zmieniono wersji aplikacji.

## Audyt różnicowy

| Stan | Funkcje |
| --- | --- |
| Istniejące, zachowane | Wspólny układ generatora, `PodgladWydrukuPaczki`, wybór paczki i skala, korekty, kolejność materiałów checklisty, integracja ze Szczegółami, historia, uprawnienia, eksport pojedynczy i zbiorczy, trzy cele QR, zapis przez `zapiszWyrenderowanyPdf`. |
| Wymagające modyfikacji | Lista materiałów bez checkboxów; zbyt szeroki domyślny kontekst szkolenia; stopka informująca o wyłączonych QR; dwustanowa gęstość zależna wyłącznie od wysokości; odcisk bez ustawień wydruku. |
| Brakujące | Rzeczywista etykieta uniwersalna, puste ilości, edycja jej katalogu, ustawienia widoczności, trzy poziomy gęstości i pomiar automatyczny, szablony konfiguracji wydruku. |

Źródłem prawdy dokumentu pozostaje wspólny rejestr poprzez `rejestrChecklistPaczek`. Szablony nadal korzystają z `ultimate-pomagier.checklisty-paczek.szablony`. Nie rozszerzano równoległych magazynów legacy i nie migrowano innych generatorów.

## Model i zgodność danych

Opcjonalne `DaneChecklistyPaczki.ustawieniaEtykiety` przechowuje rodzaj (`szkoleniowa` / `uniwersalna`), dopasowanie, tryb druku, wymiary, widoczność pól, identyfikator szablonu oraz pozycje uniwersalne. Pozycje mają stabilne ID, nazwę, `ilosc: number | null` i flagę ukrycia. Kolejność wynika z kolejności tablicy.

Normalizacja starszych dokumentów nadaje bezpieczne ustawienia domyślne. Waliduje wymiary, flagi, warianty, powtarzające się ID i ilości. Pusta ilość pozostaje `null`, a świadomie wpisane zero pozostaje zerem. Nie zmieniono granic 88–220 × 80–320 mm.

Korekty szkoleniowe zachowują dotychczasowe nazwy i ilości; dodatkowa flaga ukrywa wyłącznie pozycję wydruku. Nie zmienia materiałów źródłowych. Konfiguracja zapisuje się istniejącą funkcją `zapisz`, więc korzysta z ochrony niezapisanych danych i ponowienia przy odmowie magazynu.

Szablony wydruku są oznaczone `przeznaczenie: 'etykieta'` w istniejącym modelu szablonów i zawierają konfigurację, bez kopii materiałów źródłowych, paczek i stanów kompletowania. Osobne filtrowane odczyty nie pozwalają zastosować pustej struktury szablonu wydruku jako struktury checklisty. Starsze szablony pozostają dostępne. Nie ma limitu liczby szablonów; odmowa zapisu jest zgłaszana.

## Układ i dopasowanie

Etykieta ma zwarty nagłówek, opcjonalny kontekst, semantyczną tabelę `OK / ZAWARTOŚĆ / ILOŚĆ` i stopkę tylko wtedy, gdy istnieją dopuszczone QR. Ilości nie mają powtarzanego sufiksu jednostki. Checkboxy są ramkami CSS renderowanymi jako linie PDF, o stałym rozmiarze 3,8 mm. Nie używają emoji ani znaków zastępujących kwadrat.

STANDARD używa nazw 9 pt, KOMPAKT 8 pt, MAKSYMALNY CZYTELNY 7,5 pt. Zmniejszają się odstępy i nagłówek; checkboxy i QR zachowują rozmiar. Wybrane informacje dodatkowe nie znikają automatycznie. Nazwy zawijają się bez wielokropków i obcinania.

`dopasujEtykiete` sprawdza kolejno trzy warianty, od najbardziej czytelnego. Dla każdego wymusza rzeczywisty pomiar geometrii nagłówka, treści, komórek i opcjonalnej stopki. Wymiary strony i jej padding wyznaczają dostępny obszar. Rzeczywiste wysokości zawiniętych wierszy decydują o wyniku; liczba pozycji nie stanowi kryterium wyboru. Obliczenia uwzględniają skalę istniejącego podglądu. Pomiar jest ponawiany po wczytaniu fontów i obrazów.

Tryb ręczny sprawdza dokładnie wybrany wariant. Jeśli treść nie mieści się, wszystkie pozycje pozostają widoczne, pojawia się komunikat ze specyfikacji, a wadliwy eksport jest blokowany. Nie ma skalowania dokumentu, ukrywania overflow, przewijania wewnątrz etykiety ani automatycznego dzielenia paczki.

Przed eksportem następuje ponowne oczekiwanie na fonty i obrazy, dopasowanie oraz kontrola każdej wybranej strony. To samo drzewo semantyczne trafia do `zmierzScenePdf`, `renderujScenePdf` i `zapiszWyrenderowanyPdf`. Nie zmieniono wspólnego renderera ani adapterów platformowych. Gabaryty nie są zgadywane z wagi lub wysokości kartonu; format wybiera użytkownik.

## Wariant uniwersalny

Nie wymaga szkolenia ani grupy. Korzysta z istniejącej ręcznej checklisty, lecz ma odrębną treść wydruku. Nie drukuje danych szkolenia, trenerów, uczestników, terminów ani tekstów zastępczych. Dane źródłowe pozostają zachowane przy przełączaniu.

Katalog obejmuje 11 nazw z `utworzPozycjeDomyslne` oraz Program szkolenia i Materiały promocyjne. Nie duplikuje definicji podstawowych materiałów. Ilości domyślnie są puste i nie zależą od uczestników. Można zmienić nazwę, kolejność, widoczność, wpisać ilość, dodać własny materiał i pusty wiersz oraz zapisać całość jako szablon. Checkboxy zawsze pozostają puste niezależnie od kompletowania.

## QR — audyt ograniczeń

Zachowano cele `s` — Szczegóły, `k` — Kompletowanie, `m` — Materiały, adresy dokumentu i paczki, walidację 134 bajtów, matrycę 41 × 41 i kwadrat 25 mm ze strefą ciszy czterech modułów. Podpisy drukowane: SZCZEGÓŁY, KOMPLETOWANIE, MATERIAŁY.

Generowanie nadal wymaga DEV, lokalnego hosta, świadomej próby QR i powiązanej grupy. Uniwersalny wariant nie generuje QR. Przy wyłączeniu kodów nie powstaje stopka z komunikatem zastępczym; powierzchnia wraca do tabeli.

Trasy wymagają sesji pracownika wewnętrznego i istniejących dokumentu, paczki oraz właściwej grupy; operacje eksportu nadal sprawdzają uprawnienia. Dane są lokalne w profilu przeglądarki / WebView, a `localhost` na telefonie oznacza telefon. Sam adres nie przenosi rejestru, sesji ani załączników. Chrome w odrębnym profilu nie znajduje obiektu. Nie ma infrastruktury pozwalającej uznać te QR za produkcyjny dostęp między urządzeniami Windows / Android / Web. Zabezpieczeń nie poluzowano. Testowe pliki nadal otrzymują prefiks `TEST-QR`.

## Historia i wersjonowanie

Odcisk etykiety obejmuje konfigurację, rodzaj, szablon, nazwy, ilości, widoczność i korekty wraz z danymi dotychczasowego mechanizmu. Historia otrzymuje opcjonalny rodzaj etykiety; stare wpisy są prezentowane jako szkoleniowe. Zachowano istniejące wersjonowanie i jawne potwierdzenie fizycznego wydruku, również blokadę potwierdzania prób QR.

Ustawienia etykiet wyłączono z odcisku treści wydruku checklisty A4, podobnie jak wcześniejsze korekty etykiet. Ich zmiana nie tworzy nowej wersji niezmienionej checklisty. Wybór paczki, powiększenie i podgląd nie zapisują konfiguracji ani historii wydruków.

## Zmienione pliki

- `src/moduly/dokumenty/generatory/checklisty_paczek/PanelEtykietPaczek.tsx` — renderer tabeli, warianty, konfiguracja, szablony, kontrola dopasowania.
- `src/moduly/dokumenty/generatory/checklisty_paczek/panelEtykietPaczek.css` — lokalne style tabeli i gęstości.
- `src/moduly/dokumenty/generatory/checklisty_paczek/ustawieniaEtykietyPaczki.ts` — typy, domyślne ustawienia i normalizacja.
- `src/moduly/dokumenty/generatory/checklisty_paczek/dopasowanieEtykietyPaczki.ts` — rzeczywiste pomiary i wybór wariantu.
- `src/moduly/dokumenty/generatory/checklisty_paczek/modelChecklistyPaczki.ts` — addytywne rozszerzenie modelu.
- `src/moduly/dokumenty/generatory/checklisty_paczek/modelEtykietyPaczki.ts` — projekcja uniwersalna i konfiguracja w odcisku.
- `src/moduly/dokumenty/generatory/checklisty_paczek/rejestrChecklistPaczek.ts` — rodzaj w historii oraz oddzielenie odcisku A4.
- `src/moduly/dokumenty/generatory/checklisty_paczek/szablonyChecklistPaczek.ts` — współistnienie obu rodzajów szablonów.
- `testy/checklistaPaczki.regresja.test.ts`, `testy/checklistyPaczek.przegladarka.test.mjs` — regresja modeli, szablonów, UI i rzeczywistych PDF.
- `docs/v4/manifest-widokow.json`, `docs/v4/rejestr-widokow.md` — jedna nowa powierzchnia `details` w istniejącym panelu; właściciel V4-15 bez zmian.
- Ten raport.

## Weryfikacja automatyczna

| Kontrola | Wynik |
| --- | --- |
| `node --import ./testy/rejestrujLoaderTs.mjs testy/checklistaPaczki.regresja.test.ts` | PASS: 59 testów, 0 błędów; 2 zastane historyczne SKIP pozostały bez zmian. |
| `npm test`, razem z `pretest` | PASS, kod 0; log `tmp/etykiety-test.log`. Pierwszy przebieg wskazał brak rejestracji nowego `details` w V4; po świadomym uzupełnieniu manifestu pełny zestaw przeszedł. |
| `npm run lint` | PASS, kod 0, również po poprawie nazw dostępności. |
| `npm run build` | PASS, kod 0, również po poprawie nazw dostępności. Pozostaje zastane ostrzeżenie o dużych chunkach. |
| Test przeglądarkowy nowych etykiet | PASS: 36 kombinacji treści / formatu / koloru, własny szablon po ponownym otwarciu, edycja, kolejność, ukrywanie, puste ilości i wiersze, ręczne dopasowanie, 20 ustawień szerokości i skali wariantu uniwersalnego. |
| Pełny końcowy zestaw Chrome checklist | PASS: 8/8, 0 błędów, 0 SKIP, kod 0; około 262 s. Obejmuje 7 dotychczasowych scenariuszy i nowy test adaptacyjny. |
| `git diff --check` | PASS; ostrzeżenia Git o przyszłej konwersji LF/CRLF nie są błędami whitespace. |

Testy Chrome uruchomiono przez `node skrypty/uruchomTestyPrzegladarkowe.mjs testy/checklistyPaczek.przegladarka.test.mjs`, czyli istniejący wrapper serwerów Vite uruchamiający dokładnie `node --test testy/checklistyPaczek.przegladarka.test.mjs` z `test:checklisty:przegladarka`. Pierwsza bezpośrednia próba `npm run test:checklisty:przegladarka` w sandboxie nie mogła połączyć się z lokalnym Vite. Właściwe przebiegi wykonano poza ograniczeniem sieciowym sandboxa, z osobnymi profilami Chrome i danymi demonstracyjnymi, bez kont i danych użytkownika. Początkowe poprawki testów dotyczyły oczekiwania na utworzenie dokumentu, niejednoznacznego selektora kodu szkolenia oraz zamykania zadania PDF.js. Test nowych selektorów doprowadził też do jawnego powiązania trzech nowych pól wyboru z ich etykietami.

Zachowana macierz istniejącego testu obejmuje m.in. 390, 768, 1024, 1440 i 1920 px oraz skale aplikacji 75%, 85%, 100%, 125%. Dodatkowe 150% jest wyłącznie symulacją CSS. Nowy panel uniwersalny ma osobną macierz 5 szerokości × 4 skale. Nie utożsamiano tych kontroli z natywnym zoomem Windows.

## Rzeczywiste PDF

Przypadki 5, 8, 12, 16, 20, 40 pozycji sprawdzono na 100 × 150, 100 × 100 i 125 × 90 mm w obu trybach druku: **36 kombinacji**. **24 układy** mieszczą się i zostały pobrane rzeczywistym eksporterem aplikacji; **12** zachowuje pełne pozycje, zgłasza przepełnienie i odmawia eksportu, w tym wszystkie przypadki 40 pozycji w tych formatach. Użyto wszystkich trzech poziomów gęstości. Kontrola mierzy checkboxy około 3,798–3,800 mm niezależnie od tekstu, nazwy co najmniej 7,5 pt i jawny overflow zamiast przewijania/maskowania.

PDF-lib sprawdza fizyczny wymiar i liczbę stron, a PDF.js pełną treść nazw z polskimi znakami oraz położenia tekstu w marginesach. Osobny PDF uniwersalny potwierdza wyłącznie jawnie wpisaną ilość, pozostałe puste komórki, puste checkboxy i pusty wiersz. Dotychczasowy test generuje także PDF trzech paczek z QR oraz pojedyncze strony w trzech formatach. Dodatkowy odczyt strumieni wektorowych przez pypdf potwierdził w 25 plikach po cztery boki długości 3,8 mm na każdy checkbox; najmniejsza zmierzona grubość linii wyniosła około 0,177 mm. Dowód: `tmp/etykiety-adaptacyjne/checkboxy-pdf.json`. Czytelność na konkretnej drukarce wymaga odbioru fizycznego.

Popplerem wyrenderowano i obejrzano: `tmp/pdfs/etykiety-test.pdf` (QR), `tmp/etykiety-adaptacyjne/20-100x150-termiczny.pdf`, `16-100x100-kolorowy.pdf` i `uniwersalna-wlasna.pdf`. Potwierdzono czytelne polskie znaki, pełne nazwy, marginesy, liniową tabelę, położenie checkboxów, ilości i dolnej strefy QR. Poprawiono łamiący się nagłówek pierwszej kolumny na krótkie `OK`.

Dowody: `tmp/etykiety-adaptacyjne/wyniki.json`, 25 PDF (24 z macierzy + własny uniwersalny), PNG podglądu i renderów PDF; `tmp/pdfs/etykiety-test.pdf`; logi `tmp/etykiety-regresja.log`, `tmp/etykiety-adaptacyjne-test.log`, `tmp/etykiety-przegladarka.log`, `tmp/etykiety-test.log`, `tmp/etykiety-lint.log`, `tmp/etykiety-build.log`. Artefakty pozostają poza śledzonymi plikami Git.

## Niewykonane testy sprzętowe i odbiór manualny

Nie wykonano fizycznych wydruków, skanowania aparatem, testu natywnego WebView2, natywnego zoomu Chrome / Windows ani eksportu na rzeczywistym Androidzie. Skala aplikacji i CSS nie stanowią dowodu natywnego zoomu.

Scenariusz odbioru:

1. Na drukarce termicznej oraz kolorowej wydrukować w skali 100% próbki 100 × 150, 100 × 100 i 125 × 90 mm. Wyłączyć dopasowanie do strony. Linijką sprawdzić stronę, margines 4 mm, checkbox 3,8 mm i QR 25 mm.
2. Odhaczyć pozycje długopisem, sprawdzić rozpoznawalność nazw 7,5 / 8 / 9 pt, polskie znaki i cienkie linie. Dla przepełnienia potwierdzić odmowę eksportu zamiast brakujących pozycji.
3. W lokalnym profilu z powiązaną grupą włączyć próbę QR. Sprawdzić trzy cele i logowanie. Osobny telefon/profil ma zgłosić brak danych; nie traktować tego jako produkcyjnego QR.
4. W aplikacji Windows / WebView2 sprawdzić zapis przez natywny dialog, anulowanie i ponowienie, zmianę paczki, własny szablon po restarcie oraz natywną skalę Windows i Chrome 125% / 150%.
5. Na Androidzie sprawdzić istniejący systemowy mechanizm zapisu/udostępniania PDF i zgodność wymiarów pliku. Nie instalowano nowego wydania w ramach tej pracy.

## Ograniczenia

Pozostaje fizyczny limit localStorage; użyto dotychczasowej ochrony, kompresji i ponowienia, bez usuwania danych. Długie nazwy i duża liczba pozycji mogą wymagać większego formatu lub osobnej checklisty. Szablon uniwersalny drukowany z zapisanej checklisty jest prawidłowo powiązany z jej paczką, bez tworzenia fikcyjnego obiektu szkolenia. Brak QR produkcyjnych pozostaje ograniczeniem istniejącej infrastruktury, niezależnym od przebudowy etykiet.

## Końcowy Git

Przejrzano diff kodu, styli, testów i wpisów V4. `git diff --check` kończy się kodem 0. Working tree obejmuje wyłącznie 13 plików tego zadania: 10 zmodyfikowanych oraz 3 nowe (dwa moduły logiki i raport). Artefakty pozostają w ignorowanym `tmp/`; nie dodano ich do stage. HEAD i gałąź pozostały bez zmian. Nie utworzono commita, pushu ani wydania. Nie było zastanych zmian użytkownika do scalania lub nadpisania.
