# Finalizacja integracji Poprawiacza prezentacji — 16.11.2026

## Stan repozytorium

Gałąź `audit/integracja-galezi-release-4.1.0`, HEAD `7f2bfe5855e304fb0ac1c6be2ee5347bed10dcbd`. Na wejściu 17 śledzonych plików miało zmiany robocze, a raport poprzedniego etapu był nowym plikiem. Indeks był pusty. Pełny wykaz zastanych zmian zawiera [raport poprzedniego etapu](poprawiacz-prezentacji-render-i-okladki.md). W tej sesji jedynym dodanym plikiem źródłowym jest niniejszy raport.

Podczas testów HEAD przesunął się na `01348481e3079936ce94b13f43575afb036d82f1` (`poprawiacz-prezentacji`). Commit obejmuje 17 plików zastanych zmian i oba raporty. Źródła zmiany HEAD nie ustalono. Po zmianie HEAD końcowe uzupełnienia niniejszego raportu są jedyną różnicą w working tree, a indeks jest pusty.

## Diagnoza Cargo

Windows Code Integrity zablokował załadowanie bibliotek makr proceduralnych przez `rustc.exe`. Dziennik wskazuje między innymi `phf_macros-5aef6b43130e11f8.dll`, `windows_implement`, `zerofrom_derive` i `time_macros`. Komunikat mówi o niespełnieniu wymaganego poziomu podpisu lub naruszeniu zasad Code Integrity i wskazuje politykę `{0283ac0f-fff1-49ae-ada1-8a933130cad6}`. Rejestr systemu zwrócił `VerifiedAndReputablePolicyState = 1`. DLL `phf_macros` ma status `NotSigned`, a próbny wyłączny odczyt pliku się powiódł.

`cargo check --offline --locked --manifest-path src-tauri/Cargo.toml` zakończył się kodem 101 również poza izolacją procesu Codexa. W tej próbie Windows zablokował także uruchomienie programu skryptu budującego. Cargo zapisał poniższy komunikat.

```text
error: failed to run custom build command for `ultimate-pomagier v4.1.1 (C:\Users\madej\Documents\____GitHub_Projects\___Projekty_GitHub\Ultimate_Pomagier_4_aktualny\src-tauri)`

Caused by:
  could not execute process `C:\Users\madej\Documents\____GitHub_Projects\___Projekty_GitHub\Ultimate_Pomagier_4_aktualny\src-tauri\target\debug\build\ultimate-pomagier-3da21068bc79c74b\build-script-build` (never executed)

Caused by:
  Zasady kontroli aplikacji zablokowały ten plik. (os error 4551)
```

W logu Cargo występują również `E0463` dla `tauri_utils` i `cookie` podczas sprawdzania `tauri-runtime`. Rozstrzygnięcie tych błędów wymaga ponownego pełnego przebiegu po przywróceniu możliwości budowania. Potwierdzona blokada 4551 dotyczy wykonania artefaktów przez Windows.

Sprawdzone środowisko to Rust i Cargo 1.99.1, host i toolchain `x86_64-pc-windows-msvc`, Visual Studio Build Tools z linkerem MSVC 14.44.35207, Windows SDK 10.0.26100.0 i WebView2 157.0.4341.60. `Cargo.lock` wskazuje Tauri 2.12.5, Wry 0.57.0 i `webview2-com` 0.39.1. Npm ma Tauri API i CLI 2.12.4. `cargo tree --offline --locked -i phf_macros` potwierdza, że `phf_macros` 0.13.1 jest zależnością pośrednią Tauri przez `phf` i `tauri-utils`. Standardowa konfiguracja Tauri stosuje WebView2 z lokalnym frontendem. Profil demo uruchamia lokalny frontend na porcie 1421 i używa osobnego identyfikatora aplikacji. Zasady Windows pozostały bez zmian.

## Aplikacja Windows i renderery

Akceptacja bieżącej wersji wymaga uruchomienia programu z aktualnych źródeł. Istniejący `target/debug/ultimate-pomagier.exe` pochodzi z 10.11.2026.

`npm run test:konta:demo` zakończył się bez odnalezienia okna demonstracji. Powtórzenie zgłosiło zajęty port 1421. Po przeniesieniu Vite na port 5196 i wyłączeniu obserwacji plików na potrzeby próby, serwer wystartował, a uruchomienie `tauri dev --no-watch` doszło do `cargo run --locked --offline`. Windows ponownie zablokował program `ultimate-pomagier-9031b46d98a53833\build-script-build` błędem 4551. Testy połączenia WebView2–Rust, automatycznego podglądu, zaznaczania, geometrii, cofania i ponawiania oraz pobierania pozostały zablokowane przed otwarciem okna.

| Wariant | Wynik |
| --- | --- |
| A. PowerPoint | PowerPoint dla Windows i rejestracja COM są dostępne. Test Chrome wywołał rzeczywisty PowerPoint i sprawdził render po edycji, korzystając z testowego transportu. Potwierdzenie działania w WebView2 blokuje kompilacja. |
| B. Tylko LibreOffice | Brak `soffice.com` w standardowych lokalizacjach, brak polecenia `soffice` w PATH i brak wpisu instalacji LibreOffice w sprawdzonych rejestrach. Konwersja i automatyczny wybór zapasowego renderera pozostają bez testu na tej maszynie. |
| C. Brak obu silników | Host ma PowerPoint. W kodzie błąd renderera i brak pliku LibreOffice skutkują komunikatem o możliwości wczytania PDF. Stabilność UI w tym wariancie i dostępność funkcji bez renderera pozostają do akceptacji w działającym Tauri. |

W kodzie limit 240 s dotyczy pojedynczego procesu uruchomionego przez backend. Po przekroczeniu limitu Rust kończy i odbiera ten proces. Destruktor katalogu tymczasowego próbuje usunąć jego zawartość, a skrypt PowerPoint zwalnia obiekty COM w `finally`. Po zwykłym zakończeniu bezpośredniej próby PowerPoint udało się otworzyć do wyłącznego odczytu kopię PPTX i PDF, a w katalogu próby było zero plików blokady Office i plików `.tmp`. Wymuszone zakończenie PowerShell może przerwać wykonanie `finally`, a błąd usuwania katalogu jest ignorowany. Zwolnienie procesu COM i sprzątanie po timeoutcie wymagają próby na działającym backendzie. Suma czasu całej operacji może być dłuższa niż 240 s, jeśli po błędzie PowerPointa uruchomi się LibreOffice.

## Okładki i systemowy zapis

Moduł przekazuje PDF, PNG i edytowalny PPTX do mechanizmu pobierania WebView przez `Blob` i link z atrybutem `download`. Obsługa dialogu zależy od WebView2. Fizyczny zapis i ewentualny dialog w WebView2 pozostają do weryfikacji w działającej aplikacji.

Z testu Chrome odczytano następujące pliki fizyczne. PDF przeszedł odczyt stron przez PDF-lib, PNG otworzył się w GDI+, a archiwa PPTX przeszły kontrolę CRC i mają po jednym slajdzie. Test ponownie otworzył oba pobrane PPTX w PowerPoint.

| Format | Pionowa | Pozioma |
| --- | --- | --- |
| PDF | 1 492 430 B, jedna strona 210 × 297 mm | 1 577 448 B, jedna strona 297 × 210 mm |
| PNG | 2 411 320 B, 2480 × 3508 px | 2 402 355 B, 3508 × 2481 px |
| Edytowalny PPTX | 211 241 B, jeden slajd | 621 442 B, jeden slajd |

## Prezentacja 292 slajdów

Rzeczywisty PPTX NOVISA (1 600 328 bajtów) został ponownie wczytany przez `otworzPptx` w Node z parserem XML `@xmldom/xmldom`. Odczytano 292 slajdy w 6,8 s. W jednym przebiegu po GC sterta wzrosła o około 283 MiB, a RSS procesu o 421 MiB. Był to pomiar procesu Node podczas równoległych testów.

Lokalny skrypt renderujący PowerPoint wyeksportował wszystkie 292 strony w 87,3 s wraz z trzema zrzutami referencyjnymi. Próbka obejmowała slajd 1 z obrazami, kształtami i liniami, slajd 146 z kształtami oraz slajd 292 z obrazami i kształtami. Wszystkie trzy korzystają ze wzorców. Porównanie z bezpośrednimi zrzutami wykazało zachowany układ, tekst, grafiki i logotypy w tej próbce. Suma SHA-256 źródłowej prezentacji była identyczna przed i po. Czas przełączania slajdów, czas odświeżenia po edycji i pamięć aplikacji pozostają do pomiaru w WebView2.

Próba pomocnicza w Chrome z ręcznie wczytanym PDF PowerPointa dała 5,9 s do pojawienia się informacji o wszystkich 292 slajdach i 2,8 s od wskazania PDF do wyświetlenia pierwszej strony. Pierwszy widok slajdów 146 i 292 zajął 1,82 i 1,02 s. Powroty z pamięci podręcznej trwały 0,15–0,20 s. Zatwierdzenie edycji i pojawienie się wpisu historii zajęło 8,4 s, po czym poprzedni render zniknął. Sterta JavaScript po GC wyniosła około 6 MiB przed importem, 58 MiB po imporcie i 65 MiB po nawigacji. To pojedynczy przebieg Chrome z równoległymi testami. Ponowna konwersja edytowanej prezentacji przez WebView2 i Rust pozostaje do zmierzenia.

## Regresja i decyzja

- `npm run test:prezentacje` — 55/55.
- Testy przeglądarkowe — 6/6 w dwóch przebiegach. W pierwszym przeszły test eksportu i test z PowerPointem. Równoległy bezpośredni render zapisał pliki w katalogu obserwowanym przez Vite. Błąd `EBUSY` zatrzymał serwer i przerwał pozostałe scenariusze. Po wyłączeniu obserwacji plików w tymczasowej konfiguracji Vite przeszły pozostałe cztery scenariusze, w tym druk dla 292 slajdów, edycja, historia, skalowanie, dotyk i pamięć podręczna PDF.
- `npm test`, `npm run lint`, `npm run build`, `git diff --check` — zaliczone. Vite zgłasza ostrzeżenie o rozmiarze pakietu.
- `cargo check` i uruchomienie aktualnego Tauri — blokada Windows Code Integrity 4551. Test integracyjny demo zakończył się bez działającego okna.

**Integracja wstrzymana.** Warunki odbioru wymagają stanowiska Windows, na którym zasady Code Integrity dopuszczają uzgodnione artefakty budowania Rust. Po udanej kompilacji należy uruchomić bieżące Tauri z rzeczywistym wywołaniem Rust, sprawdzić pełny przepływ edycji PPTX i zapisać trzy formaty dla obu orientacji. Warianty B i C wymagają dodatkowo stanowisk o odpowiedniej dostępności lokalnych rendererów.
