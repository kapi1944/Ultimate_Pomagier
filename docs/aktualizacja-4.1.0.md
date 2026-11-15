# Aktualizacja Ultimate Pomagiera do 4.1.0

Oficjalne pliki i sumy SHA-256 będą w [wydaniu v4.1.0](https://github.com/kapi1944/Ultimate_Pomagier/releases/tag/v4.1.0) po jego publikacji.

## Kopia przed aktualizacją

1. Zapisz formularze. Na każdym urządzeniu i w każdym używanym profilu wybierz **Ustawienia → Dane → Utwórz kopię teraz**. Jeśli aplikacja udostępnia też **Pobierz kopię migracyjną E4**, zapisz ją osobno. Zawiera zdjęcia paczek z IndexedDB. Sprawdź, czy pliki można odczytać i zachowaj je w chronionym miejscu.
2. W Windows całkowicie zamknij aplikację. Skopiuj cały katalog `%LOCALAPPDATA%\pl.ultimatepomagier.desktop` do osobnej lokalizacji. Obejmuje lokalną bazę kont, profile WebView2 i dane użytkowników. Pozostaw bazę razem z plikami towarzyszącymi. Zapamiętana sesja DPAPI jest powiązana z kontem Windows.
3. Dla WEB zachowaj ten sam adres, protokół i port. Zabezpiecz pliki dotychczasowego wdrożenia oraz bazę i konfigurację usługi kont. Jeśli inne urządzenie ma osobną instalację lub profil, wykonaj na nim osobną kopię.

## Instalacja i odbiór

- **Windows biurowy, domowy i pozostałe komputery x64**. Zweryfikuj SHA-256 pliku `Ultimate_Pomagier_4.1.0_Setup.exe`. Użyj panelu aktualizacji na kanale stabilnym albo uruchom ręcznie instalator na tym samym koncie Windows i potwierdź aktualizację istniejącej instalacji. Zachowaj dotychczasowy profil. Jeśli polityka firmowa odrzuci instalator, zgłoś to administratorowi.
- **Android ARM64**. Zweryfikuj SHA-256 pliku `Ultimate_Pomagier_4.1.0_Android_arm64.apk` oraz zgodność certyfikatu z poprzednią instalacją. Android powinien zaproponować aktualizację istniejącego pakietu `pl.ultimatepomagier.desktop`. Przy błędzie zgodności podpisów zachowaj poprzednią aplikację i jej dane.
- **WEB**. Zweryfikuj SHA-256 pliku `Ultimate_Pomagier_4.1.0_WEB.zip`. Wdróż rozpakowaną zawartość na dotychczasowym originie, z dotychczasową konfiguracją usługi kont. Zweryfikuj `wersja.json`, `tryb-frontendu.json` i działanie logowania.

Po aktualizacji sprawdź wersję 4.1.0 w aplikacji. Zaloguj się, sprawdź dokumenty, szkice, historię, Szczegóły Organizacyjne, Programy Szkoleń, ustawienia, Pulpit, rutyny i magazyn. Otwórz aplikację ponownie i sprawdź przykładowy eksport. Zachowaj kopie do zakończenia odbioru.

## Test przejścia 4.0.0 → 4.1.0

1. W zatwierdzonej, odizolowanej instancji Windows x64 lub Android ARM64 zainstaluj artefakt 4.0.0. Na syntetycznym koncie utwórz dane we wszystkich wymienionych obszarach, dodaj zdjęcie paczki, zmień ustawienia interfejsu i zapisz wersję dokumentu oraz kopię roboczą.
2. Zapisz wynik kontroli i wykonaj kopię jak wyżej. Na Windows sprawdź też reakcję na zamknięcie okna z niezapisanymi zmianami. Zainstaluj wersję 4.1.0 na istniejącej instalacji.
3. Powtórz kontrolę na tym samym koncie po pierwszym uruchomieniu i po restarcie. Sprawdź podgląd i eksport dokumentu. Zapisz wersję, identyfikator, wynik odczytu każdego obszaru danych i wynik kontroli aktualizatora Windows. Jeśli na kanale stabilnym nie ma nowszej wersji, oczekiwany wynik to informacja o braku nowszego wydania.
