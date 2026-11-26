# Etykiety paczek 2.1 — DT4x, 24.11.2026

Zmiany wykonano na czystej gałęzi main, bez aktualizacji aplikacji Windows, publikacji, commita i pushu. Zachowano generator 2.0, katalog, korekty, historię, szablony, QR i renderer PDF.

## Dostęp

Kafelek Checklista paczek w zapisanych Szczegółach ma akcję Etykiety paczek. Korzysta z istniejącej fabryki utwórz/otwórz dla właściwej grupy. Dwukrotne użycie otwiera ten sam dokument. Warunek zapisanych Szczegółów i grupy pozostał zachowany; eksport nadal podlega dotychczasowym uprawnieniom.

W nagłówku checklisty jest link Nowa etykieta uniwersalna. Dostęp bez Szczegółów: `/dokumenty/checklisty-paczek?etykiety=uniwersalna`. Powstaje zwykła ręczna checklista z istniejącą konfiguracją uniwersalną; adres otrzymuje ID, więc reload nie tworzy drugiego dokumentu. Nie wymaga grupy.

## Druk

Obok Pobierz PDF etykiety działa Drukuj etykietę. Najpierw przechodzi istniejące dopasowanie i walidację eksportu. Używa wspólnego drukujDokument, rozszerzonego o wymiary w mm i możliwość wskazania samej strony. Systemowe okno jest otwierane wyłącznie po kliknięciu. Nie wybiera drukarki i nie drukuje bez dialogu. Fizyczny wydruk wymaga osobnego potwierdzenia użytkownika po zamknięciu dialogu. Anulowanie nie oznacza wykonania wydruku.

Lokalny CSS utrzymuje rozmiar etykiety, wewnętrzny padding 4 mm, zerowy margines strony oraz usuwa skalę podglądu przy druku. Domyślne ustawienia pozostają 100 × 150 mm, pionowo, termicznie B/W. Zachowano inne formaty i tryb kolorowy. Wiele paczek można pobrać jako dotychczasowy wielostronicowy PDF i wydrukować razem.

## Kontrole

- Regresja checklist: 59 PASS, 2 zastane SKIP, 0 FAIL.
- Przeglądarka: 8/8 dotychczasowych testów PASS; osobno 2/2 nowych testów PASS (wejście uniwersalne/reload, systemowy druk/anulowanie, kafelek Szczegółów i brak duplikacji).
- Macierz etykiet 2.0 obejmuje 5, 8, 12, 16, 20 i 40 pozycji, polskie nazwy, ilości, checkboxy, trzy gęstości i blokowanie przepełnienia. Sprawdza rzeczywiste PDF 100 × 150, 100 × 100 i 125 × 90 mm oraz eksport wielu paczek.
- PDF pobrany przez renderer ma 100 × 150 mm, jedną paczkę na stronę, bez konwersji do A4. Testy sprawdzają MediaBox z tolerancją 0,01 mm.
- Systemowy druk przechwycony przez Chrome: jedna strona, MediaBox 282,96 × 425,04 pt (około 99,822 × 149,945 mm). Jest to zaokrąglenie mechanizmu drukowania Chrome, a nie zmiana formatu PDF pobieranego z aplikacji. Dla pierwszego odbioru sprzętowego zalecany jest pobrany PDF o dokładnym rozmiarze.
- Sprawdzono geometrię paddingu 4 mm w trybie print. Fizyczna poprawność tego marginesu na DT4x pozostaje niepotwierdzona.
- Testy używały wyłącznie izolowanych profili Chrome i danych demonstracyjnych. Nie modyfikowano produkcyjnych danych użytkownika.
- Logi: `tmp/etykiety21-*.log`; próbka druku: `tmp/etykiety21/druk-systemowy.pdf`. Artefakty poza Git.

## Pierwszy wydruk na Etykieciarka DT4x (211)

1. Otwórz zapisane Szczegóły → Przygotuj dokumenty → Checklista paczek → Etykiety paczek. Alternatywnie otwórz checklistę i wybierz Nowa etykieta uniwersalna.
2. Wybierz paczkę, format 100 × 150 mm i Termiczny B/W. Usuń przyczynę ewentualnego ostrzeżenia o przepełnieniu.
3. Pobierz PDF etykiety. Otwórz go w czytniku PDF i wybierz Drukuj. Możesz też przetestować przycisk Drukuj etykietę w aplikacji.
4. Wybierz Etykieciarka DT4x (211). W preferencjach sterownika ustaw papier 100 × 150 mm i orientację pionową.
5. Ustaw Rozmiar rzeczywisty / 100%, jedną stronę na arkusz, jedną kopię. Wyłącz Dopasuj, Pomniejsz do obszaru druku, A4 oraz nagłówki i stopki przeglądarki. Dodatkowe marginesy ustaw na brak; margines bezpieczeństwa jest już wewnątrz etykiety.
6. Wydrukuj jedną sztukę. Zmierz etykietę i marginesy, sprawdź wszystkie nazwy, polskie znaki, ilości, możliwość odhaczania checkboxów i ewentualne QR. Dopiero po fizycznym sprawdzeniu potwierdź wydruk w aplikacji.
7. Dla wielu paczek użyj Pobierz PDF wszystkich etykiet i wydrukuj wszystkie strony na takich samych ustawieniach.

Odbiór sprzętowy DT4x, skanowanie oraz natywny dialog Windows/WebView2: NIEWYKONANE — fizyczna drukarka i natywne środowisko nie były używane. Nie zmieniono sterownika ani zainstalowanej aplikacji Windows. Produkcyjne ograniczenia QR pozostają bez zmian.

## Wyniki końcowe

`npm test` (wraz z pretest), `npm run lint`, `npm run build` oraz `git diff --check`: PASS. Build zgłasza istniejące ostrzeżenie o dużych chunkach. Testy eksportu po rozszerzeniu mechanizmu druku: 12/12 PASS; zaktualizowano atrapę DOM o metodę matches, bez wyłączania asercji. Manifest V4 rejestruje nowe potwierdzenie fizycznego wydruku. Diff został przejrzany, bez zmiany modeli dokumentów lub migracji magazynów. Wszystkie zmiany pozostają niezacommitowane na main.
