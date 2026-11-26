# Globalna wyszukiwarka — audyt i wdrożenie, 2026-11-26

## Stan bazowy

Gałąź `main`, HEAD `8eb4ea2505eb392cf91f4067404a59c20020eabe`. Początkowo istniały lokalne zmiany w `modelChecklistyPaczki.ts`, `widokChecklistPaczek.css` i `checklistaPaczki.regresja.test.ts`. Nie modyfikowano tych trzech plików. Bez zmiany gałęzi, commita, push, merge i publikacji.

## Ustalenia audytu

- Wspólny nagłówek: `src/aplikacja/layout/NaglowekAplikacji.tsx`, montowany przez `UkladAplikacji` dla wszystkich modułów po zalogowaniu.
- Nawigacja jest własna: `WidokNawigacji`, konfiguracje tras, `history.pushState`/`popstate` oraz stan Reacta. Nie ma React Routera. Wykorzystano dotychczasowe otwieranie dokumentów i strażnika niezapisanych zmian.
- Menu i dock mają wspólną listę dostępnych widoków. Źródło funkcji wyszukiwarki korzysta z tej listy.
- Dotychczasowe wyszukiwanie jest lokalne dla modułów: m.in. filtry dokumentów i kartotek, indeks miejscowości ładowany na żądanie. Nie znaleziono istniejącego ogólnego indeksu ani biblioteki fuzzy search.
- Dokumenty i Szczegóły organizacyjne czytają obecnie wspólny rejestr dokumentów v3 z pamięcią odczytu. Starsze magazyny i autosave nadal istnieją; wyszukiwarka nie dodaje do nich równoległego odczytu ani migracji. Przeczytano audyty magazynów danych i systemu dokumentów oraz zweryfikowano ich historyczne ustalenia z aktualnym kodem.
- Kartoteka klientów ma gotowy czytnik. Pełna normalizacja kartoteki trenerów była lokalna w komponencie: przeniesiono ją do istniejącego modułu `trenerzyKartoteki.ts`, zachowując dotychczasowy kontrakt czytnika dla generatorów.
- Zadania ręczne pochodzą z magazynu Pulpitu, automatyczne z istniejących reguł szkolenia. Ich funkcję odczytu współdzielą teraz Pulpit i adapter wyszukiwania.
- Produkty pochodzą z istniejącego magazynu lokalizacji i danych magazynowych v2.
- Dostęp opiera się na istniejących funkcjach aktywności konta, pracownika wewnętrznego i administracji, regułach widoczności kopii Szczegółów oraz widoczności zadań dla konkretnej osoby. Prywatne dokumenty są dodatkowo ograniczane do autora, właściciela lub administratora.
- Nagłówek korzysta z tokenów `--ui-*` i istniejących ikon menu. Zachowano breakpoint mobilny 760 px. Wyszukiwarka nie ładuje dużego katalogu lokalizacji.

## Zaimplementowana architektura

`mechanizmWyszukiwania.ts` zawiera rejestr źródeł, kontrakt wyniku i celu nawigacji, normalizację, ranking, grupowanie, limity, anulowanie i historię. Źródła rejestrują się przez `wyszukiwarkaGlobalna.zarejestruj(...)`; funkcja zwraca wyrejestrowanie. Adapter otrzymuje użytkownika, `AbortSignal`, frazę albo identyfikator rekordu oraz limit. Pozwala to dodać w przyszłości adapter serwerowy bez pobierania całego zbioru na klienta. Obecnie wszystkie adaptery korzystają z lokalnych magazynów aplikacji, bez nowych API i zależności.

`zrodlaWyszukiwania.ts` składa istniejące czytniki w źródła. Odczyt następuje dopiero po otwarciu wyszukiwarki i debounce 200 ms. Pusta fraza rozwiązuje identyfikatory historii; bez historii nie czyta kolekcji. Skanowanie oddaje sterowanie co 250 rekordów, sprawdza anulowanie i utrzymuje najwyżej 5 wyników na kategorię. Nazwa ma wyższą wagę od opisu i informacji dodatkowych. Każde słowo frazy musi pasować. Obsługiwane są fragmenty, wielkość liter, polskie znaki oraz pojedyncze dodanie, usunięcie, podmiana lub przestawienie sąsiednich liter dla słów od 4 znaków.

`WyszukiwarkaGlobalna.tsx` udostępnia combobox/listbox, skróty Ctrl+K/Cmd+K, czyszczenie, strzałki, Home/End, Enter, Esc, zamknięcie poza panelem i przy opuszczeniu focusu. Skrót nie przechwytuje klawiatury otwartego modalu. Są komunikaty ładowania, pustej frazy, braku wyników, awarii adaptera i ograniczonego dostępu. Wyniki poprzedniego kontekstu użytkownika nie są prezentowane. Mobile używa lupy i rozwijanego pola; pozostawiono miejsce dla przycisku menu.

Otwarcie wyniku ponownie odczytuje rekord i uprawnienia, również po decyzji w dialogu niezapisanych zmian. Wykorzystuje istniejące przejścia widoków oraz otwieranie generatorów. Parametr `rekord` wybiera konkretną kartotekę, szkolenie, zadanie lub produkt. Rekord kartoteki otwiera jej istniejący formularz, produkt — wyodrębnione stany magazynowe, szkolenie — istniejący podgląd. Zmiana rekordu w tym samym widoku odświeża właściwą instancję. Parametry są uwzględniane przy powrocie przeglądarki; odświeżenie kartoteki korzysta z istniejącego `history.state`. Nie dodawano osobnego routera ani nawigacji przez DOM.

Kartoteki i formularz zadania podłączono do istniejącego `useOchronaNiezapisanegoDokumentu`. Zapis przed przejściem jest synchronicznie potwierdzany przez istniejący magazyn. Błąd zapisu zachowuje formularz. Domyślne przypomnienia nowego zadania są porównywane ze stabilnym stanem początkowym.

Historia przechowuje najwyżej 10 identyfikatorów w `ultimatePomagier.wyszukiwanie.v1.<uzytkownikId>`, bez nazw, treści rekordów i fraz wyszukiwania. Jest oddzielna dla każdego konta, odczytywana defensywnie i filtrowana ponownie przez adaptery. Zapis następuje po wykonaniu przejścia, nie po anulowanej próbie. Nie zmieniano formatu istniejących danych biznesowych.

Polecenia `+`: Utwórz szkolenie (zgodnie z uprawnieniem domenowym), Dodaj zadanie, Dodaj klienta, Otwórz magazyn, Otwórz generator dokumentów. Otwierają formularze lub moduły; nie wykonują operacji destrukcyjnych.

## Rzeczywiście przeszukiwane dane

| Kategoria | Zakres |
| --- | --- |
| Szkolenia | Opublikowane Szczegóły organizacyjne i dostępne kopie robocze; nazwy, klient, grupy i daty |
| Klienci | Nazwa, NIP, miejscowość, koordynator |
| Trenerzy | Pełna bieżąca kartoteka, również nieaktywni; imię, nazwisko, telefon, e-mail, status |
| Zadania i terminarz | Zadania ręczne i automatyczne widoczne dla zalogowanej osoby; tytuł, opis, termin, status |
| Dokumenty | Aktywne dokumenty wspólnego rejestru; tytuł, typ, status, data modyfikacji |
| Magazyn | Rzeczywiste produkty istniejącego magazynu; nazwa, rodzaj, jednostka |
| Moduły i funkcje | Rzeczywiste pozycje nawigacji z kontekstem, z ograniczeniem administracji |

## Ograniczenia i integracje oczekujące

- Szkolenia otwarte mają wyłącznie ekran informacyjny — brak repozytorium rekordów. Wyszukiwana jest funkcja otwierająca ekran, bez fikcyjnych szkoleń.
- Terminarz jest częścią Pulpitu. Zadania i daty szkoleń są uwzględnione; rutyny, bloki harmonogramu i ich wystąpienia nie mają jeszcze adapterów wyników.
- Nie przeszukuje się binarnej treści PDF/DOCX, zdjęć i załączników ani niezintegrowanych danych legacy. Adapter dokumentów obejmuje metadane wspólnego rejestru, bez dodatkowej migracji.
- Kartoteki nie mają osobnych profili rekordów, a magazyn osobnego ekranu karty produktu. Zastosowano istniejący formularz rekordu i widok stanów wybranego produktu.
- Tolerancja literówek obejmuje jedną operację na słowo od 4 znaków. To lokalne dopasowanie metadanych, bez pełnotekstowego indeksu treści dokumentów.
- Dane są lokalne, zgodnie z aktualną architekturą. Dla przyszłych dużych zbiorów serwerowych adapter musi wykorzystywać przekazaną frazę/ID/limit i filtrować uprawnienia po stronie serwera.
- Uprawnienia wyszukiwarki nie zastępują autoryzacji pozostałych istniejących ścieżek aplikacji.

## Pliki zadania

Nowe:

- `src/aplikacja/wyszukiwanie/mechanizmWyszukiwania.ts`
- `src/aplikacja/wyszukiwanie/zrodlaWyszukiwania.ts`
- `src/aplikacja/wyszukiwanie/WyszukiwarkaGlobalna.tsx`
- `src/aplikacja/wyszukiwanie/wyszukiwarkaGlobalna.css`
- `src/moduly/zamkniete/pulpit/uslugi/zadaniaAutomatycznePulpitu.ts`
- `testy/wyszukiwanieGlobalne.test.ts`
- `testy/wyszukiwanieGlobalne.przegladarka.test.mjs`
- `docs/audyty/globalna-wyszukiwarka-2026-11-26.md`

Zmodyfikowane:

- `src/aplikacja/layout/NaglowekAplikacji.tsx`
- `src/aplikacja/layout/UkladAplikacji.tsx`
- `src/kartoteki/WidokKartotek.tsx`
- `src/kartoteki/trenerzyKartoteki.ts`
- `src/kartoteki/lokalizacje/magazynLokalizacji.ts`
- `src/moduly/zakupy/magazyn/WidokStanowMagazynowych.tsx`
- `src/moduly/zamkniete/pulpit/WidokPulpitu.tsx`
- `src/moduly/zamkniete/szczegoly_organizacyjne/widoki/WidokListySzczegolowOrganizacyjnych.tsx`
- `src/moduly/zamkniete/szczegoly_organizacyjne/widoki/WidokKopiiRoboczychSzczegolowOrganizacyjnych.tsx`
- `testy/pulpit.regresja.test.ts` — istniejąca kontrola resetu uwzględnia zapamiętanie stanu początkowego formularza.
- `package.json` — skrypty wyszukiwarki i dołączenie jej testów do `npm test`.
- `docs/v4/manifest-widokow.json`
- `docs/v4/rejestr-widokow.md`

## Weryfikacja

- `npm test` — cały skrypt, łącznie z pretestami, kontami i nowymi testami wyszukiwarki: kod zakończenia 0.
- `npm run test:wyszukiwanie` — 9/9 testów mechanizmu i rzeczywistych adapterów; uruchomione również jako końcowy etap `npm test`.
- `npm run test:wyszukiwanie:przegladarka` — 4/4 scenariusze w Chrome: skróty obu platform, polskie znaki i literówki, nawigacja klawiaturą, historia, polecenia, czyszczenie, Esc także z przycisku czyszczenia, kliknięcie poza panelem, odświeżenie rekordu, anulowanie/porzucenie/zapis przed nawigacją, konkretne rekordy wszystkich kategorii, zadanie automatyczne i awaria adaptera.
- Responsywność sprawdzona przy 1920, 1440, 1024, 768, 760, 390 i 320 px, wraz z zachowaniem elementów nagłówka. Zrzuty desktop i mobile zostały obejrzane; mobilne pole nie nakłada się na przycisk menu. Artefakty lokalne: `tmp/wyszukiwanie/desktop.png` i `tmp/wyszukiwanie/mobilna.png` (katalog ignorowany przez Git).
- Test nowego zadania z domyślnym przypomnieniem potwierdza brak fałszywego ostrzeżenia w pustym formularzu i skuteczny zapis wpisanego zadania przed przejściem.
- Test 10 000 rekordów: około 0,55 s w końcowym przebiegu, limit 5 wyników, potwierdzone oddawanie sterowania pętli zdarzeń. Jest to pomiar mechanizmu na metadanych, nie obietnica czasu odpowiedzi każdego magazynu.
- `npm run lint` — kod zakończenia 0.
- `npm run build` — kod zakończenia 0. Pozostają ostrzeżenia Vite o dużych chunkach i modułach importowanych jednocześnie statycznie oraz dynamicznie; nie blokują budowy.
- `git diff --check` — bez błędów; diff przejrzano. Nie wykonywano ręcznej sesji NVDA/VoiceOver; sprawdzono semantykę combobox/listbox i obsługę focusu oraz klawiatury w Chrome.

## Stan Git po pierwotnej implementacji

`main`, HEAD `8eb4ea2505eb392cf91f4067404a59c20020eabe`, bez zmiany commita względem stanu początkowego. Zmiany zadania pozostają w working tree; trzy początkowe zmiany checklist paczek zachowano. Nie wykonano stage, commita, push, merge ani publikacji. Stan zdalnego serwera nie był odpytywany.

## Finalizacja i zakres PR — 2026-11-26

Ponownie sprawdzono kompletność powyższych 21 plików oraz ich diff. Lokalny i zdalny `main` wskazywały `8eb4ea2505eb392cf91f4067404a59c20020eabe`; gałąź `feat/globalna-wyszukiwarka` nie istniała na origin. Zmiany profili użytkowników nie zostały rozpoczęte w kodzie.

Prezentacja skrótu w nagłówku to teraz `Ctrl + K`, bez symbolu Command. Podpowiedź jest ukrywana do 760 px oraz dla głównego wskaźnika dotykowego (`pointer: coarse`), także na szerokim ekranie Androida. Obsługa Ctrl+K i Meta+K pozostaje bez zmian.

Ostatnia lokalna zmiana `testy/pulpit.regresja.test.ts` odpowiada zmianie resetowania formularza: sprawdza utworzenie `noweDane`, przekazanie ich do formularza i zapamiętanie identycznego stanu początkowego. Nadal sprawdza wyczyszczenie wyboru, powrót do tworzenia i brak wywołania zapisu. Nie osłabia kontroli anulowania zadania. Poprzedni commit zmieniający ten test: `93dc546`.

Wyniki ponownej weryfikacji przed integracją:

- `npm test` wraz z pretestami, testami kont i wyszukiwarki — kod 0.
- `npm run lint` — kod 0.
- `npm run build` — kod 0; pozostają opisane wyżej ostrzeżenia bundlera.
- `npm run test:wyszukiwanie` — 9/9, kod 0; test 10 000 rekordów około 0,53 s w osobnym uruchomieniu.
- `npm run test:wyszukiwanie:przegladarka` — 5/5, kod 0. Dodano kontrolę dokładnej etykiety `Ctrl + K`, braku symbolu Command i niewidocznej podpowiedzi mobilnej oraz osobną emulację Androida Pixel 7 przy szerokości telefonu i 1024 px. To emulacja Chrome, nie test na fizycznym Androidzie.
- Ponownie obejrzano zrzuty desktop/mobile; nagłówek zachowuje responsywność w testowanych szerokościach 320–1920 px.
- `git diff --check` — kod 0.

Zakres commita to dokładnie lista 21 plików w sekcji „Pliki zadania”. Poza nim pozostają `modelChecklistyPaczki.ts`, `widokChecklistPaczek.css` oraz `testy/checklistaPaczki.regresja.test.ts`. Porównanie SHA256 wszystkich trzech plików potwierdziło zachowanie ich zawartości. Wyszukiwarka nie zależy od dodanej w tych zmianach pozycji „Programy”; współdzielony odczyt automatycznych zadań korzysta z istniejących wcześniej funkcji checklist.

Docelowa gałąź PR: `feat/globalna-wyszukiwarka`, baza `main`. Nie wykonuje się merge ani publikacji wydania. SHA commita i adres PR są podawane w raporcie końcowym integracji.
