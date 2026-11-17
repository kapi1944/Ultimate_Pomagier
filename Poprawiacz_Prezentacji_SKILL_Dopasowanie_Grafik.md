---
name: dopasowanie-grafik-do-obszaru-slajdu
version: 1.0
parent: Poprawiacz Prezentacji
language: pl
status: gotowe-do-wlaczenia
---

# Umiejętność: Bezpieczne dopasowanie grafik i zrzutów ekranu do slajdów

## 1. Cel

Podczas poprawiania prezentacji PowerPoint wykrywaj duże grafiki, zdjęcia, zrzuty ekranu, schematy i obrazy wstawione przez trenerów, które zasłaniają lub przecinają firmowy nagłówek, logo, górny pasek, dolną stopkę, numer slajdu albo inne stałe elementy szablonu. Automatycznie **przesuń i/lub proporcjonalnie zmniejsz tylko obiekty będące przyczyną kolizji**, tak aby w całości mieściły się w rzeczywistym obszarze treści danego slajdu.

**Reguła nadrzędna: przywróć widoczność szablonu, bez przebudowy treści slajdu.** Nie próbuj „poprawiać” grafiki przez modyfikowanie jej tekstów, przycinanie, spłaszczanie lub zastępowanie innym obrazem.

## 2. Zakres

- Prezentacje `.pptx`, w tym długie prezentacje z różnymi układami i wzorcami.
- Obrazy rastrowe (`PNG`, `JPEG`, `TIFF`, itp.), zrzuty ekranowe, wklejone diagramy, grafiki wektorowe tam, gdzie da się bezpiecznie zachować ich strukturę, oraz grupy obiektów stanowiące jeden logiczny diagram.
- Elementy tła lub na wzorcach, logotypy, paski i firmowe numery stron są **elementami chronionymi**, nie obiektami do automatycznego zmniejszania.
- Nie obejmuje automatycznej redakcji tekstu ani przebudowy układu slajdu poza niezbędnym przesunięciem/skalowaniem obrazu lub jednorodnej grupy wizualnej.

## 3. Wykrywanie obszarów chronionych

Dla każdego slajdu ustal osobno rzeczywistą strefę treści i obszary chronione:

1. Odczytaj rozmiar slajdu, jego `slideMaster` i `slideLayout`, obiekty dziedziczone, lokalne kształty, tła oraz kolejność nakładania.
2. Zlokalizuj logo, nagłówek, górny pasek, stopkę, numerację, slogany i powtarzalne elementy marki. Nie zakładaj, że zawsze są w obiektach bieżącego slajdu: mogą być częścią wzorca, motywu albo obrazu tła.
3. Uwzględnij także zwykły tytuł, podtytuł i inne istotne obiekty umieszczone w części merytorycznej – nowa pozycja grafiki nie może ich zasłaniać.
4. Wyznacz bezpieczny prostokąt (lub zbiór wolnych prostokątów) z niewielkim buforem między zawartością a nagłówkiem/stopką. Domyślny bufor: **0,2 cm**, konfigurowalny.
5. Na slajdach bez takich pasów (np. okładka, slajd działowy, celowa grafika pełnoekranowa) nie narzucaj automatycznie marginesów standardowego slajdu.
6. Jeśli stref nie da się wiarygodnie odczytać ze struktury PPTX, porównaj render slajdu z renderem wzorca oraz z innymi slajdami korzystającymi z tego samego układu. Niejednoznaczności oznacz do przeglądu.

**Ważne:** współrzędne pasów nie mogą być zakodowane na stałe dla wszystkich prezentacji. Różne szablony i proporcje slajdów mają różne granice.

## 4. Wybór grafiki do poprawy

1. Wyszukaj obiekty graficzne i grupy. Przeanalizuj ich rzeczywiste granice wizualne, w tym obrót, przekształcenia grup, przycięcia i ewentualne cienie.
2. Oznacz kolizję, jeśli widoczna grafika nachodzi na strefę chronioną, zasłania jej treść lub wystaje poza slajd. Dla diagnozy odnotuj, z którym obszarem występuje konflikt.
3. Odseparuj treść trenera od grafiki będącej częścią samego szablonu. Powtarzalność, umiejscowienie na wzorcu, nazwa i relacje obiektów, procent powierzchni oraz kontekst są sygnałami, **nie pojedynczymi rozstrzygającymi warunkami**.
4. Preferuj duże obrazy i screenshoty jako kandydatów do automatycznej korekty. Niewielkie ikony, elementy nawigacyjne, znaki firmowe i artystyczne obiekty celowo wychodzące poza kadr nie są automatycznie zmieniane.
5. Gdy grafika leży częściowo na pasku, ale jest ewidentnie elementem świadomego projektu, nie narzucaj zmiany bez wysokiej pewności rozpoznania.

## 5. Sposób poprawiania

Dla każdego jednoznacznie rozpoznanego obrazu:

1. **Najpierw sprawdź samo przesunięcie.** Jeśli obraz mieści się w dostępnym obszarze bez zmiany skali, wybierz minimalne przesunięcie, które usuwa kolizję.
2. Jeśli przesunięcie nie wystarcza, **zmniejsz proporcjonalnie**. Współczynnik: `k = min(1, dostępna_szerokość / szerokość, dostępna_wysokość / wysokość)`. Stosuj jednolity współczynnik do obu wymiarów; żadnego rozciągania.
3. Umieść obraz w wolnym obszarze, zachowując – gdy możliwe – dotychczasową linię wyrównania i kompozycję. Jeśli oryginalnie był wyśrodkowany, zachowaj centrowanie.
4. Zapewnij bufor bezpieczeństwa od każdego chronionego pasa i nie wprowadzaj kolizji z innymi istotnymi elementami slajdu.
5. **Nie przycinaj, nie zakrywaj, nie przesłaniaj grafiki maską, nie zmieniaj jej warstwowania jako zastępnika poprawnego dopasowania.** Zachowaj cały widoczny obszar źródłowy, pierwotne przycięcie (jeśli istniało), jakość bitmapy, style, ramki, cienie, przezroczystość, hiperłącza oraz ewentualne animacje.
6. Nie powiększaj obrazu w ramach tej umiejętności. Nie poprawiaj na siłę jakości grafiki ani nie próbuj odczytywać i przepisywać tekstu ze screenshotu.
7. Jeśli obiekt jest jedną logiczną grupą diagramu, dopasuj grupę jako całość, zachowując relacje jej elementów. Jeśli bezpieczna edycja grupy jest niemożliwa – zgłoś, nie rozbijaj jej automatycznie.
8. Zachowaj numery slajdów w stopce; nie pomyl ich z dodatkową numeracją nałożoną lokalnie przez trenera. Osobna umiejętność usuwania duplikatów numeracji musi działać niezależnie od tej umiejętności.

### Szczególny przypadek: obraz prawie pełnoekranowy

Gdy wklejony screenshot zajmuje niemal całą wysokość slajdu i przykrywa oba pasy, dopasuj go **wewnątrz przestrzeni między pasami**, podobnie jak w przykładzie „przed/po”: górny firmowy obszar staje się widoczny, cały obraz pozostaje czytelny i proporcjonalny, dolna stopka oraz numer slajdu są odkryte. Zwykle wymaga to jednoczesnego zmniejszenia i centrowania obrazu.

## 6. Niepewność, czytelność i wyjątki

- Jeśli potrzebne zmniejszenie spowoduje, że drobny tekst zawarty na obrazie będzie praktycznie nieczytelny, nie dziel, nie ucinaj i nie przepisuj treści samodzielnie. Oznacz slajd jako `wymaga_oceny`: zaproponuj np. podział materiału na dwa slajdy **dopiero po zgodzie użytkownika**.
- Jeśli kilka dużych grafik konkuruje o tę samą przestrzeń, zastosuj układ bez kolizji tylko wtedy, gdy da się go ustalić bez zmiany sensu wizualnego; w innym przypadku zgłoś konflikt.
- Jeśli obraz jest celowo użyty jako pełnoekranowe tło na okładce/rozdziale, nie zmieniaj go tylko dlatego, że obejmuje całą powierzchnię.
- Jeżeli obiekt wychodzi poza ekran w ramach przemyślanej kompozycji lub jest częścią szablonu, traktuj to jako wyjątek.
- Nie edytuj zaszytych w bitmapie pasków czy numerów – to elementy samego obrazu. Jeżeli przeszkadzają, zgłoś problem bez retuszu.

## 7. Integralność pliku i minimalność zmian

**Najważniejszy warunek techniczny:** jeśli zmienia się tylko rozmiar i pozycja grafiki, nie może przypadkiem zmienić się nic innego.

- Stosuj możliwie najmniej inwazyjne aktualizacje transformacji kształtów (`x/y/cx/cy`, ewentualnie macierzy grupy) w odpowiednich częściach OOXML. Nie reserializuj całej prezentacji tylko po to, by zmienić kilka współrzędnych, jeśli grozi to utratą funkcji programu PowerPoint.
- Nie edytuj oryginalnych danych medialnych, tekstów, notatek, przejść, animacji, szablonu, grafik firmowych, relacji do mediów, kolejności slajdów ani identyfikatorów obiektów.
- Zapisz nowy plik PPTX pod odrębną nazwą; oryginał pozostaw bez zmian.
- Przy wykryciu nietypowego obiektu lub ryzyka utraty jego funkcji, pozostaw go bez zmian i zgłoś problem zamiast uszkodzić prezentację.

## 8. Kontrola jakości po korekcie

Po zapisaniu wynikowego pliku:

1. Zweryfikuj integralność ZIP/OOXML i możliwość ponownego otwarcia PPTX.
2. Upewnij się, że liczba, kolejność i treść slajdów są identyczne.
3. Sprawdź, że media (`ppt/media`) mają identyczne sumy kontrolne; wyjątki są niedopuszczalne dla tego zadania.
4. Porównaj XML pakietu: dozwolone są tylko transformacje obiektów wskazanych w raporcie (ewentualnie techniczne zmiany bez wpływu wizualnego, gdy są nieuniknione i zweryfikowane). Wszystkie pozostałe elementy pozostają nietknięte.
5. Porównaj obrazy przed/po po renderowaniu tym samym silnikiem. Pas firmowy, logo, numer i stopka muszą być widoczne, a obraz nie może być zniekształcony czy obcięty. Na pozostałych obszarach obraz slajdu ma pozostać wizualnie taki sam poza przesuniętym obiektem i miejscem, które wcześniej zasłaniał.
6. Sprawdź liczbę kolizji przed/po, w tym współrzędne rzeczywiste obrazu po obrocie i transformacjach.
7. Raportuj osobno: **poprawione**, **już poprawne**, **celowo pełnoekranowe**, **wymaga oceny**, **błąd**.

## 9. Raport

Wynik powinien zawierać:

- nazwę pliku wejściowego i wynikowego;
- liczbę przebadanych slajdów, znalezionych grafik i wykrytych kolizji;
- liczbę automatycznie poprawionych obrazów i slajdów;
- listę zmian: `slajd`, `identyfikator/nazwa obiektu`, `przyczyna`, `geometria przed`, `geometria po`, `współczynnik skali`, `status`;
- listę wyjątków wraz z jasną przyczyną braku automatycznej zmiany;
- informację o pomyślnej walidacji i zachowaniu pozostałych elementów.

## 10. Kryteria odbioru (testy)

1. **Grafika obejmuje header i footer:** po korekcie całe oryginalnie widoczne zdjęcie mieści się między pasami, logo, numer i stopka nie są zasłonięte, proporcje są zachowane.
2. **Kolizja tylko z dolną stopką:** minimalna zmiana położenia; jeśli nie wystarcza, proporcjonalne zmniejszenie.
3. **Grafika już poprawna:** żadnych zmian współrzędnych ani XML.
4. **Grafika i tytuł:** grafika nie może nachodzić na tytuł; jeśli brakuje miejsca, status `wymaga_oceny`.
5. **Grupa schematu:** wewnętrzne odstępy i proporcje nie zmieniają się.
6. **Okładka z pełnoekranowym tłem:** nie zmienia się.
7. **Kilka układów i wzorców w jednym pliku:** każdy slajd jest oceniany względem własnego wzorca.
8. **Obraz obrócony/przycięty:** ocena uwzględnia widoczny obszar i nie zmienia kadru.
9. **Gęsty zrzut ekranu:** w razie nieczytelnego efektu narzędzie nie niszczy układu, tylko zgłasza konieczność decyzji.
10. **Kontrola minimalności:** dokładnie te obrazy, które wymagają zmiany, mają zmienione przekształcenia. Brak innych regresji.

## 11. Weryfikacja na dostarczonym przykładzie

Załączona prezentacja „Prawo Pracy na Co Dzień – Warsztat dla Praktyków.pptx” ma **387 slajdów** w formacie **13,333 × 7,5 cala (16:9)**. W analizie struktury stwierdzono **160 obrazów na 132 slajdach**. Slajd **64** zawiera duży obraz o pozycji około `x=0,88", y=0,06"` i wymiarach `11,58" × 7,38"`, praktycznie od górnej do dolnej krawędzi. To przykład do testu dopasowania obrazu do wnętrza slajdu.

Wstępna kontrola samych prostokątów obiektów wykazała **32 obrazy przecinające jednocześnie umowne pasy górny i dolny**. To **kandydaci do szczegółowej oceny**, nie 32 potwierdzone błędy: niektóre mogą stanowić zamierzone tła, a rzeczywisty obszar ochronny trzeba odczytać z układu/wzorca.

Na udostępnionych zrzutach ekranowych pokazano pożądany rezultat: **ten sam screenshot jest zmniejszony proporcjonalnie i wyśrodkowany**, dzięki czemu widoczne pozostają firmowy nagłówek z logo oraz stopka z numerem slajdu. Nie wolno przy tym ingerować w zawartość samej grafiki.

## 12. Gotowa dyspozycja uruchamiająca umiejętność

> Wykonaj umiejętność „Bezpieczne dopasowanie grafik i zrzutów ekranu”. Na każdym slajdzie ustal obszary nagłówka i stopki z faktycznego wzorca. Znajdź grafiki trenera, które je zasłaniają; przesuń je, a gdy trzeba – proporcjonalnie zmniejsz do wolnej strefy treści, z marginesem 0,2 cm. Nie przycinaj obrazów, nie rozciągaj, nie modyfikuj żadnych innych elementów ani wzorców. Zweryfikuj plik i przygotuj raport zmian. W razie niejednoznaczności lub ryzyka nieczytelności oznacz slajd do ręcznej oceny zamiast automatycznie zmieniać układ.
