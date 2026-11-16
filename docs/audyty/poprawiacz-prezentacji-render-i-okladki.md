# Poprawiacz prezentacji — render PPTX i okładki SEMPER

## Ustalenia audytu

| Etap | Kod i przepływ |
| --- | --- |
| Import | `WidokPoprawiaczaPrezentacji.analizuj` czyta plik użytkownika. `otworzPptx` sprawdza ZIP, korzysta z `xmlPptx` do odczytu OOXML i z `relacjePptx` do rozwiązania ścieżek i ustalenia kolejności slajdów. |
| Model slajdu | `slajdyPptx` odczytuje akapity, obiekty, tabele, proste kolory i transformacje grup. `geometriaPptx` odczytuje transformacje i przelicza EMU. `wzorcePptx` rozwiązuje powiązania slajd → układ → wzorzec i przekazuje odziedziczone położenie pól. `otworzPptx` odczytuje XML motywów i liczy podpisy obrazów do porównania. Interpretację motywów, efektów i pełnej typografii wykonuje lokalny renderer. |
| Podgląd | `TrybyPrezentacji` wybiera aktualny slajd i pasujący render. `PodgladSlajdu` wyświetla stronę PDF jako obraz z PDF.js. `PodgladStrukturalny` wyświetla kontury, skróty tekstów i oznaczenia obrazów w podglądzie uproszczonym. Nad obrazem PDF wyświetla interaktywne pola o znanej geometrii. Miniatury korzystają z modelu strukturalnego. |
| Edycja | `WlasciwosciObiektu` i warstwa interaktywna korzystają z `edycjaPrezentacji` i `zmianyPptx`. `historiaPrezentacji` przechowuje różnice między wersjami XML. `analizujPrezentacje` i `analizujUklad` dostarczają problemy oraz bezpieczne marginesy. `porownaniePrezentacji` i `porownaniePikseli` porównują obiekty i obrazy. |
| Render lokalny | `renderowaniePdf` wywołuje polecenie Tauri w `prezentacje.rs`. W Windows skrypt `renderuj_prezentacje.ps1` otwiera kopię pliku w PowerPoint przez COM. LibreOffice działa w trybie headless. W przeglądarce i na Androidzie użytkownik może wczytać PDF z aktualnej kopii PPTX. |
| Okładka | `PanelPrzygotowania` korzysta ze Szczegółów organizacyjnych i wybranej grupy lub pól ręcznych. `mapowanieDanych` przekłada wartości na tekst. `okladkiSemper` wypełnia trzy pola na pierwszym slajdzie odrębnego wzorca dla każdej orientacji. |
| Zapis i eksport | `zapiszPptx` pakuje edytowalną kopię. `PanelEksportu` wybiera oryginalny wzorzec SEMPER lub pierwszy slajd importu jako źródło PDF/PNG. `planDruku` wyznacza obszar A4, `eksportMaterialow` składa wydruk, PNG i ZIP. `pobierzPlikMaterialow` oraz `pobierzKopiePptx` przekazują pliki mechanizmowi pobierania hosta. |

### Przyczyny

- Import czytał wszystkie węzły `sldId`, w tym osobne identyfikatory sekcji PowerPointa. Sekcje mogły zatrzymać odczyt poprawnego pliku. Po imporcie i każdej edycji główny ekran wyświetlał uproszczony model do czasu ręcznego renderowania. PDF o tej samej liczbie stron i innych proporcjach rozciągano pod warstwą obiektów.
- Windows korzystał wyłącznie z PowerPointa. Błąd odczytu wysokości tekstu przez COM mógł zatrzymać eksport PDF. Przy pobieraniu samego PDF okładki aplikacja generowała też PNG, więc błąd PNG blokował PDF. Generator zachowywał grafiki z archiwum, ale brak powiązanego pliku nie był błędem. Przycisk edytowalnego PPTX pobierał wzorzec SEMPER także przy wybranym „Pierwszym slajdzie”.

## Implementacja

- Automatyczny lokalny render po imporcie i zatwierdzeniu edycji, w tym cofnięciu i ponowieniu. Można edytować w trakcie renderu. Aplikacja przyjmuje wynik tylko dla aktualnej wersji modelu i współdzieli trwające żądanie tej samej wersji z eksportem. Tauri przekazuje PPTX i PDF binarnie. Przeglądarka rasteruje widoczną stronę PDF, a zmiana trybu korzysta z pamięci podręcznej.
- Obraz PDF i nakładka mają wspólne wymiary. Niezgodny PDF wyświetla komunikat i pozostawia podgląd strukturalny. Obiekty o złożonej lub obróconej geometrii można wskazać na liście. Windows próbuje PowerPointa, a po błędzie uruchamia LibreOffice z typowego katalogu instalacji, jeśli jest dostępny. Linux korzysta z lokalnego LibreOffice.
- Warianty SEMPER zachowują oryginalne archiwa szablonów, identyfikację wizualną i edytowalne pola. Przed podstawieniem danych sprawdzane są odwołania do grafik slajdu, układu i wzorca. PDF A4 można pobrać niezależnie od wykonania PNG. Panel rejestruje błędy przygotowania, zapisu i rozpoczęcia pobierania. Użytkownik może ponowić operację z tymi samymi danymi.

## Zmienione pliki

- Podgląd i dane — `PanelPrzygotowania.tsx`, `PodgladSlajdu.tsx`, `PodgladStrukturalny.tsx`, `TrybyPrezentacji.tsx`, `WidokPoprawiaczaPrezentacji.tsx`, `poprawiaczPrezentacji.css`.
- OOXML i okładki — `pptx/relacjePptx.ts`, `operacje/okladkiSemper.ts`.
- Eksport — `eksport/PanelEksportu.tsx`, `eksport/eksportMaterialow.ts`, `eksport/renderowaniePdf.ts`.
- Tauri — `src-tauri/src/prezentacje.rs`, `src-tauri/src/renderuj_prezentacje.ps1`.
- Testy — `testy/przygotowaniePrezentacji.test.ts`, `testy/prezentacje.przegladarka.test.mjs`.
- Rejestr panelu diagnostyki — `docs/v4/manifest-widokow.json`, `docs/v4/rejestr-widokow.md`.

## Zakres potwierdzenia

- `npm run test:prezentacje` — 55/55. Przypadek 196 slajdów korzysta z syntetycznego PPTX zawierającego sekcję PowerPointa. Testy obejmują również akapity, zachowanie formatowania, obrazy, wzorce i brakujące zasoby.
- Scenariusz PowerPoint przeszedł dla obu pobranych, edytowalnych okładek. PowerPoint otworzył je ponownie i z każdej wyeksportował jedną stronę. Aplikacja pobrała PDF A4 obu orientacji i PNG. Sprawdzono retry po braku szablonu, udany PDF przy awarii kodowania PNG, PDF pierwszego slajdu importu oraz ponowny render po zatwierdzeniu edycji. Zrzuty PowerPointa i wyjściowe PNG obejrzano obok siebie. Obie orientacje zachowały logotypy, kody QR, fotografie, tła i położenie tekstu, z proporcjonalnym dopasowaniem do A4.
- Odczytano także rzeczywisty PPTX referencyjny NOVISA. PowerPoint wyeksportował wszystkie 292 slajdy. Slajdy 1, 146 i 292 porównano wizualnie z bezpośrednimi zrzutami PowerPointa. Kompozycja, grafiki i tekst były zbieżne w tej próbce. Suma kontrolna źródła pozostała identyczna. Test druku dla syntetycznych 292 slajdów dał jedną stronę okładki i 146 stron materiałów.
- Testy przeglądarkowe — 6/6 w przebiegach zakresowych, w tym scenariusz PowerPoint. Sprawdzono wspólne położenie obrazu i nakładki przy 100%, 150%, 200% i 400%, zaznaczanie i historię edycji, odrzucenie nieproporcjonalnego PDF oraz ponowny render.
- `npm test`, `npm run lint`, `npm run build` i `git diff --check` — zaliczone. Build zgłasza ostrzeżenie o rozmiarze pakietów.

Do powtórzenia scenariusza z lokalnym PowerPointem uruchom aplikację demonstracyjną na porcie 5180, ustaw `POMAGIER_TEST_POWERPOINT=1` i uruchom `npm run test:prezentacje:przegladarka`. Ten scenariusz wywołuje PowerPoint przez skrypt projektu i zastępuje transport Tauri w przeglądarce.

## Ograniczenia integracji

Windows zatrzymał `cargo check --offline --locked` podczas ładowania `phf_macros` (błąd zasad kontroli aplikacji 4551). Pełne potwierdzenie integracji wymaga kompilacji i próby w WebView2 oraz testu w Windows z LibreOffice. Wierny podgląd w przeglądarce i na Androidzie korzysta z ręcznie wczytanego PDF. Duża prezentacja może wymagać ponownego renderowania przez kilka minut. Złożone obiekty zachowują ograniczenia edycji modelu. Samodzielny, edytowalny PPTX z pierwszego slajdu importowanej prezentacji wymaga osobnej obsługi wyodrębniania części OOXML. Użycie szablonów SEMPER udostępnia PPTX dla obu orientacji.
