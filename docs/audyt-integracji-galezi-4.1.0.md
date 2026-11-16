# Audyt gałęzi Ultimate Pomagier 4.1.0

## Wynik integracji

- Commit `eb37aaaea0153eed979fb07e06fa6479cc28dab3` zawiera zmiany aplikacji. Przed scaleniem gałąź robocza była czysta. Zdalny `main` po scaleniu wskazywał `0da854373df8ffbfa6e660e5441713289d20280d`. [PR #6](https://github.com/kapi1944/Ultimate_Pomagier/pull/6)
- Kontrole PR zakończyły się sukcesem. Build Windows utworzył instalator testowy, a build Android utworzył APK debug. Po scaleniu przeszły CI i budowanie instalatora Windows na `main`. [CI PR](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43843918462) · [Windows PR](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43843918485) · [Android PR](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43843918578) · [CI main](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43846009423) · [Windows main](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43846009243)
- Lokalna macierz Playwright przeszła 54 z 55 przypadków w pierwszym przebiegu poza sandboxem. Test produkcyjnego logowania uruchomiony na zastępczym porcie zakończył się timeoutem. Jego powtórka na oczekiwanym porcie 47831 oraz dodatkowy test preferencji i PDF Programów przeszły. Dodatkowe 13 testów magazynu, monitora i prezentacji oraz test centrum wersji przeszły.
- Wszystkie 10 pobranych plików ze szkicu 4.1.0 ma rozmiary i sumy SHA-256 zgodne z metadanymi GitHub. Sumy instalatora, APK i WEB są zgodne z manifestem oraz plikami kontrolnymi. Publiczny klucz aktualizatora zweryfikował podpis Ed25519 instalatora oraz podpis metadanych Minisign. [Szkic 4.1.0](https://github.com/kapi1944/Ultimate_Pomagier/releases/tag/untagged-7d6b9eae10d4320c70e0)
- Nowy tag `v4.1.1` wskazuje SHA `0da854373df8ffbfa6e660e5441713289d20280d`. Podpisane buildy Windows i Android, paczka WEB oraz tworzenie szkicu zakończyły się sukcesem. W szkicu jest 10 plików, w tym instalator EXE, APK arm64, ZIP WEB, trzy sumy kontrolne, podpis Tauri i trzy manifesty. Weryfikacja pobranych plików potwierdziła SHA-256, podpis Ed25519 i komentarz Minisign, zgodność `latest.json`, wersji i SHA źródeł. Pipeline zweryfikował certyfikat APK, a kontrola pakietu potwierdziła `versionCode=4001001` i obecność natywnej klasy zapisu PDF. [Build 4.1.1](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43846095477) · [Szkic 4.1.1](https://github.com/kapi1944/Ultimate_Pomagier/releases/tag/untagged-1c6a06b7203ba1012029)
- Odbiory na podpisanych artefaktach przeszły dla przejść 4.0.0 → 4.1.1 i 4.1.0 → 4.1.1. Na izolowanym Windows sprawdzono konto, zadanie, kopię roboczą, zachowanie edycji po anulowaniu zamknięcia, zapis przy zamknięciu i ponowny start. Na emulatorze Android sprawdzono instalację APK na istniejącym pakiecie, konto po dwóch startach oraz utworzenie nowego pliku Karty na drzwi z nagłówkiem `%PDF-` i zakończeniem `%%EOF`. [Odbiór z 4.0.0](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43851953970) · [Odbiór z 4.1.0](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43851048127)
- Końcowy `origin/main` to `7c8165344b8187bf456634f6c56274a2236550c0`. Po podpisanym wydaniu wprowadzono na `main` wyłącznie poprawkę selektora w `testy/aktualizacjaAndroid.natywna.py`. CI i build Windows dla tej poprawki przeszły w PR. [PR #7](https://github.com/kapi1944/Ultimate_Pomagier/pull/7) · [CI](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43851052911) · [Windows](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43851052926)
- Środowisko publikacji `wydania-produkcyjne` dopuszcza tagi `v4.0.0` i `v4.1.0` oraz wymaga zatwierdzenia recenzenta. Publikacja 4.1.1 wymaga objęcia `v4.1.1` regułą tego środowiska i ukończenia odbioru.

## Zapis PDF i odzyskane zmiany

| Źródło | Zmiana | Integracja | Kontrola |
| --- | --- | --- | --- |
| `archive/stash-2026-11-14-1` | Wybór lokalizacji zapisu pakietu Windows | Przycisk w `PanelPakietu.tsx`, opcjonalny systemowy dialog w `pakiety_pdf.rs` i `zapis_pdf.rs`. Zapis w Pobranych pozostaje dostępny. Zapis stosuje wyłączne tworzenie plików i numeruje kolizje. | Test Rust zapisu i kolizji, kompilacja instalatora Windows, ręczny odbiór dialogu |
| `archive/stash-2026-11-14-2` | Usunięta grupa blokuje również pakiet zawierający wyłącznie dokumenty wspólne | Reguła w `modelPakietu.ts`. Testy w `testy/wyborPakietuPdf.test.ts` sprawdzają też zachowanie zapisu przy błędnym schemacie. | `npm run test:pakiety-pdf`, 18/18 |
| `testy/odbior-windows-4.1.0` | Odbiór po aktualizacji istniejącej instalacji | `odbior-natywny.yml` oraz dwa testy natywne. Wybór przebiegu i wersji przekazuje operator, a zadania Windows i Android ruszają niezależnie. | Windows sprawdza pierwsze i drugie uruchomienie, konto, zadanie, kopię i strażnika. Android sprawdza konto, zapamiętany login i utworzenie rzeczywistego PDF. |
| Błąd ujawniony podczas odbioru | Wspólny natywny zapis pojedynczego PDF i pakietu na Androidzie | Wspólny eksporter przekazuje bajty do istniejącego polecenia zapisu. `zapis_pdf_android.rs` i `ZapisPdf.kt` zapisują przez systemowy wybór pliku obsługiwany od API 26. `budujAndroid.mjs` instaluje źródło Kotlin w generowanym projekcie Gradle. | Odbiór Android wymaga nowego pliku z oczekiwaną nazwą i nagłówkiem oraz końcem PDF. |

Pakiet nadal korzysta z istniejących adapterów generatorów, wyboru dokumentów po stabilnym ID, sygnatury źródeł, spisu treści i wspólnego scalenia. Podgląd oraz eksport pobierają ten sam wygenerowany plik. Przeglądarka korzysta ze swojego mechanizmu pobierania.

W stashach sprawdzono także dodatkowe drzewa plików nieśledzonych. Test zapisu z archiwum 1 dotyczył prototypu wyboru miejsca. Archiwum 2 zawierało raport, załącznik i prototyp przeglądarkowego File System Access API. Przeglądarka pozostaje przy standardowym pobieraniu z ustawieniami lokalizacji przeglądarki. Test ustawień Programu z archiwum 3 jest dostępny w `main`. Archiwum 4 zachowuje wcześniejszą asercję wizualną uchwytu i starsze presety. Obecny renderer Programu zachowuje zasoby SEMPER, korzysta z aktualnej paginacji i udostępnia nowszy eksport DOCX. W gałęzi parsera stary commit usuwał dwie listy robocze i artefakt terminala z powtarzającymi się znakami `OB`. Porządek uwzględnia `aa11699`.

## Instalator Windows i przebiegi odbioru

- `43712712191` na `b4f96c0`: kompilacja Windows zakończona sukcesem. [GitHub Actions](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43712712191)
- `43713741684` na tym samym SHA: podpisane buildy Windows i Android, WEB oraz przygotowanie szkicu zakończone sukcesem. [Przygotowanie 4.1.0](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43713741684)
- `43717235450`, próba 1, SHA `61062cc2ab5f90b9f56e9c15c7d15bfd79f0e232`, workflow „Instalator Windows”, wynik `failure`. Zadanie `odbior-android` nie przeszło kroku `Run python testy/aktualizacjaAndroid.natywna.py`. `instalator` i `odbior-migracji` zostały pominięte przez warunki gałęzi odbiorowej. Test zachował konto po instalacji APK i dwóch startach, zapisał kartę, a następnie zgłosił `RuntimeError: Brak wyeksportowanego PDF w katalogu Download`. W tym wydaniu pojedynczy eksport opierał się na `jsPDF.save()` w Android WebView, a natywne polecenie pakietu jawnie odrzucało Androida. [Log zadania](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43717235450/job/132821291819)
- `43715684738`: natywna aktualizacja Windows 4.0.0 → 4.1.0 potwierdziła konto, zadanie, szkic, anulowanie zamknięcia z edycją i drugi start. `43716173072`: Android potwierdził aktualizację konta i zapamiętanego loginu, przed dodaniem asercji PDF. [Windows](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43715684738) · [Android](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43716173072)
- Pierwsze odbiory 4.1.1 przeszły na Windows z obu wersji bazowych. Na Androidzie aktualizacja zachowała konto i zapamiętany login, a eksport otworzył systemowy selektor z nazwą `TestowaKartaOdbior410_Karta_na_drzwi.pdf` w katalogu Download. Skrypt szukał identyfikatora `action_menu_save`, podczas gdy emulator zwrócił aktywny przycisk `android:id/button1` w pakiecie DocumentsUI. Poprawiono selektor testowy i powtórzono odbiór na podpisanych artefaktach z tego samego przebiegu. [Pierwszy odbiór z 4.0.0](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43849431646) · [Pierwszy odbiór z 4.1.0](https://github.com/kapi1944/Ultimate_Pomagier/actions/runs/43849437006) · [PR testowy #7](https://github.com/kapi1944/Ultimate_Pomagier/pull/7)

Na gałęzi odbiorowej nie było PR. Warunki jobów celowo rozdzielały build instalatora i odbiór istniejących artefaktów. Historia nie zawiera decyzji o odrzuceniu tych zmian do `main`.

| Commit z gałęzi odbiorowej | Znaczenie |
| --- | --- |
| `541f133` | Odbiór wdrożonej instalacji Windows w izolowanym profilu |
| `461f5e9` | Oczekiwanie na rejestrację strażnika przed zamknięciem okna |
| `2f48db2` | Test istniejącej instalacji APK w emulatorze |
| `aada5a3` | Zapis w dialogu zamknięcia i druga kontrola po restarcie |
| `333d247` | Rozdzielenie odbiorów Windows i Android |
| `5da05e1` | Odizolowany katalog AVD |
| `b71eb3e` | Klawiatura sprzętowa i widoczność formularza emulatora |
| `42fe702` | Pierwsza asercja pliku PDF z Karty na drzwi |
| `cbed03b` | Etykiety menu porównywane bez rozróżniania wielkości liter |
| `61062cc` | Zapis karty testowej przed rzeczywistym eksportem |

## Wydanie i kontrole

- `v4.1.0` wskazuje `b4f96c00e55878ed01ae372a818c157fe8555d1f`. Szkic zawiera instalator EXE, podpis Tauri `.sig`, APK arm64, WEB ZIP, pliki SHA-256, `latest.json`, `windows-stabilny.json` i rejestr wydania. Build zweryfikował certyfikat APK i spójność manifestów. Sam fakt istnienia pliku `.sig` nie stanowi odrębnego testu aktualizacji przez aktualizator. [Szkic 4.1.0](https://github.com/kapi1944/Ultimate_Pomagier/releases/tag/untagged-7d6b9eae10d4320c70e0)
- Poprawka ma numer 4.1.1, ponieważ szkic 4.1.0 ma już gotowe artefakty i własny tag. Wydanie 4.1.1 wymaga oddzielnych podpisanych artefaktów, odbioru oraz zatwierdzenia w środowisku GitHub `wydania-produkcyjne`.
- Lokalnie przeszły `npm test`, `npm run lint`, `npm run build`, testy konfiguracji desktopowej, dystrybucji i Launchera, `cargo fmt --check` oraz `git diff --check`. Vite zgłosił ostrzeżenie o rozmiarze części chunków.
- Lokalna kontrola systemowa Windows blokowała uruchomienie skryptów kompilacji Cargo aplikacji i usługi kont, kod 4551. Potwierdzenie kompilacji natywnej wymaga runnera Windows. Lokalnie brak SDK i NDK Androida.
- Pozostałe kontrole wydania obejmują pełny profil z zapisanymi szkoleniami, dokumentami, preferencjami i historią po natywnej migracji, wybór folderu i kolizję nazw w systemowym oknie Windows oraz zapis zbiorczego pakietu w natywnym Androidzie. Regresje modelu, kopii E4 i pobierania pakietów w przeglądarce przeszły. Aktualizator Windows sprawdzono w testach konfiguracji i przeglądarki oraz przez niezależną weryfikację podpisu rzeczywistego instalatora. Odbiór natywny uruchamiał podpisany instalator, a test pobrania z publicznego kanału stabilnego wymaga aktywnego wydania.

## Utrzymywanie gałęzi

- Zachować `main`, pięć `archive/stash-*`, `backup/straznik-formularzy-praca-2026-11-14` i gałąź odbioru do zakończenia odbioru poprawki.
- Zintegrowane gałęzie A z zamkniętymi PR lub bez PR są kandydatami do usunięcia po potwierdzeniu, że nie służą jako aktywny checkout lub stały punkt odniesienia. PR #3 można zamknąć jako już zintegrowany po decyzji właściciela.
- Nowe gałęzie robocze prowadzić pod `feature/*`, `fix/*`, `release/*`, `hotfix/*`, a punkty odzyskiwania pod `archive/*`.

## Stan repozytorium

- Repozytorium `kapi1944/Ultimate_Pomagier`. Początkowy lokalny HEAD `692dfbfe6800f635d1ba28273473be6a46792572` na `wydanie/4.1.0`, czyste drzewo.
- Baza `origin/main` `b4f96c00e55878ed01ae372a818c157fe8555d1f`, wskazywana przez istniejący tag `v4.1.0` i PR #5. Utworzono gałąź `audit/integracja-galezi-release-4.1.0`.
- Audyt objął 35 gałęzi obecnych na GitHub przed utworzeniem gałęzi roboczej. Wszystkie lokalne gałęzie miały zdalne odpowiedniki o tym samym SHA. Pięć lokalnych referencji `refs/backup/stash-*` odpowiada pięciu gałęziom `archive/stash-*`.
- Domyślny refspec klonu pobierał jedynie `main`. Do audytu pobrano jawnie wszystkie `refs/heads/*`. Sprawdzono graf historii, wspólnego przodka, różnice patchy, aktualny kod oraz dodatkowe drzewa archiwalnych stashów.

## Gałęzie

Relacja w kolumnie „tylko main / tylko gałąź” dotyczy bazy audytu. Zero po stronie gałęzi oznacza, że jej HEAD znajduje się w historii bazy, więc zestaw plików względem wspólnego przodka jest pusty. Dla gałęzi rozbieżnych wykaz plików znajduje się poniżej tabeli.

Klasy użyte w tabeli to A (zintegrowana), C (zawierała niezintegrowaną funkcjonalność w chwili audytu) i F (archiwum). Historyczne kontrole CI i Windows przeszły dla PR #2–#5. GitHub nie zwrócił kontroli dla PR #1.

| Gałąź | HEAD | Data autora · autor | Tylko main / tylko gałąź | Klasa | PR | Zakres i rozstrzygnięcie |
| --- | --- | --- | --- | --- | --- | --- |
| `archive/stash-2026-11-14-0` | `ef47ee9ff0bf079e6172b5ad229d02acc8b8d5c2` | 2026-11-07 · Kapi | 22/2 | F | — | Presety i preferencje Programu są w `main`. Obecny model dodaje wcięcia i DOCX. |
| `archive/stash-2026-11-14-1` | `843762ae5f787cbe15651e2a0f6f65ad17e25c38` | 2026-11-07 · Kapi | 22/3 | F | — | Odzyskano wybór miejsca zapisu pakietu Windows, bazując na aktualnym zapisie bez nadpisywania. |
| `archive/stash-2026-11-14-2` | `deed3705c3c7b3ba7aa7ae8415ce722cca05368f` | 2026-11-07 · Kapi | 22/3 | F | — | Odzyskano walidację usuniętej grupy i test nienaruszania zapisu przy błędnej konfiguracji. |
| `archive/stash-2026-11-14-3` | `a8fb56e5b13fb453a59b2c92d535cd4f26768c40` | 2026-11-07 · Kapi | 22/5 | F | — | Panel UX-2 i ustawienia Programu mają odpowiedniki w `main`, w tym test preferencji `7cc9e56`. |
| `archive/stash-2026-11-14-4` | `61562539672281574e1fe4972ee194bd95b6c33a` | 2026-11-07 · Kapi | 27/2 | F | — | Testy istniejących presetów i PDF używają nowszego wspólnego modelu. Historyczny test sprawdzał wygląd uchwytu przełącznika i reset presetu. |
| `backup/straznik-formularzy-praca-2026-11-14` | `1c4467f11aaa6f9e50adec9cf8171e34d4120ee8` | 2026-11-14 · Kapi | 11/0 | F | — | Kopia WIP strażnika, przodek `main`, zachować jako punkt odzyskiwania. |
| `codex/hierarchia-lokalizacji-magazynowych` | `35da0b59b810bd1e0fb0ec21bf8456c147c3af26` | 2026-11-12 · Kapi | 13/0 | A | — | Hierarchia lokalizacji magazynowych w PR #4. |
| `codex/integracja-v4-desktop` | `82c2ed1c7f0f49b7d797ec983172863ce6faa5f8` | 2026-10-22 · Kapi | 71/0 | A | — | Integracja V4 desktop i konfiguracja natywna. |
| `codex/modal-rutyn-osi-czasu` | `4ae98c226c9cff44f6431e33a975e03cf57bcfc0` | 2026-11-13 · Kapi | 12/0 | A | — | Modal rutyn Pulpitu i układ osi czasu w PR #4. |
| `codex/plan-dnia-24h` | `d646e5d9d798742649f42af53dd736a8b6954b08` | 2026-07-27 · Kapi | 181/0 | A | — | Pełna doba w Planie dnia. |
| `etap-4a/stabilizacja-generatora-szczegolow` | `6c185b63f50d79e1cddbd5b1a041c5c238a8b5b3` | 2026-07-13 · kapi1944 | 277/0 | A | [#1](https://github.com/kapi1944/Ultimate_Pomagier/pull/1) | Stabilizacja Szczegółów i warstwowanie panelu na tablecie. |
| `etap-4b/sekcje-i-grupy-szkoleniowe` | `733eec57adb365894abba7cbe9759944dcd58f60` | 2026-07-13 · kapi1944 | 275/0 | A | — | Sekcje i karty grup. |
| `etap-4c/domkniecie-dynamicznych-pol-i-walidacji` | `e7eea83834e97e1d26dee4073aa6bfc3552ded79` | 2026-07-13 · kapi1944 | 272/2 | A | — | Ten sam plik `logikaPolDynamicznych.ts` i walidacja po ID, rozszerzona na aktualnym formularzu. |
| `etap-4d/docelowy-system-kopii-dokumentow` | `886ef537a84fd04dd1865bcbdfa338c3974aa087` | 2026-07-14 · kapi1944 | 267/0 | A | — | Rozdzielony autosave i kopie Programu. |
| `etap-5a/fundament-modelu-dokumentow` | `e702d28b13dbba9cb1834857da50310bdf6c74c4` | 2026-07-14 · kapi1944 | 265/0 | A | — | Wspólny model dokumentów. |
| `etap-5b/rejestr-i-listy-dokumentow` | `dde6ad44166343f72098f7eb1b132365ae3de7db` | 2026-07-14 · kapi1944 | 263/0 | A | — | Rejestr i listy dokumentów. |
| `etap-5c/programy-w-rejestrze` | `472919b16b06b82df90cce424fd2aaa6a2209852` | 2026-07-14 · kapi1944 | 261/0 | A | — | Programy w rejestrze. |
| `etap-5d/migracja-generatorow-i-draftow` | `ee1898fa650354d8c55de020a0450fc4049a3360` | 2026-07-14 · kapi1944 | 259/0 | A | — | Migracja generatorów i draftów. |
| `etap-5e/wersjonowanie-i-stabilizacja` | `73697bfeae16d30a4d24d58e1fe9b6c8b40ae96d` | 2026-07-15 · kapi1944 | 255/0 | A | — | Wersje dokumentów i stabilizacja kalendarza. |
| `etap-5f/kontekst-integracji-dokumentow` | `85d32f37532e56a97a2b98b5216fbb6fe1da66e5` | 2026-07-15 · kapi1944 | 253/0 | A | — | Kontekst Szczegółów dla dokumentów. |
| `etap-5g/listy-obecnosci-ze-szczegolow` | `807e16161e5c67ce26a86ad2c36de19d5837f1db` | 2026-07-15 · kapi1944 | 245/0 | A | — | Listy obecności generowane ze Szczegółów. |
| `feat/logo-menu-boczne` | `2115636d409507896a2feb1667ec68c680b5490b` | 2026-07-16 · kapi1944 | 241/0 | A | — | Logo menu bocznego. |
| `feat/logowanie-role-odznaki` | `e1672351ba88c9a1087cc89e3ad9fbc525560399` | 2026-07-20 · kapi1944 | 209/0 | A | — | Role, odznaki i rozwój checklist. |
| `feat/ultimate-pomagier-v4` | `661b73773e6737aed52c6a67164f1f57a4887a4b` | 2026-10-22 · Kapi | 77/0 | A | — | V4 i kompletowanie paczek. |
| `fix/walidacja-sekcji-i-porownanie-wersji` | `3a45f821f7547aec3f78ff3439e2ef620a710048` | 2026-07-16 · Kapi | 228/0 | A | — | Walidacja sekcji, porównanie i domyślne opcje Szczegółów. |
| `g1a/programy-wzorce-semper-czysta` | `e29defd726a6cecd1e949b69d768f96e0b783c7b` | 2026-07-16 · kapi1944 | 242/1 | A | — | Odpowiednik `2d16e15`. Te same zasoby SEMPER, aktualny renderer łączy warianty i podgląd eksportu. |
| `integracja/proba-magazyn-2026-11-14-141210` | `ba98899a81a40a42ae325161c52b548891d20322` | 2026-11-15 · Kapi | 3/0 | A | [#4](https://github.com/kapi1944/Ultimate_Pomagier/pull/4) | Strażnik, magazyn, rutyny i responsywność checklist. |
| `integracja/ux-1b` | `336d852bae94d8e132ccdc62e16b5fce7f3d1e61` | 2026-11-06 · Kapi | 23/0 | A | [#2](https://github.com/kapi1944/Ultimate_Pomagier/pull/2) | Segmenty wyboru w kartach grup Szczegółów. |
| `main` | `b4f96c00e55878ed01ae372a818c157fe8555d1f` | 2026-11-15 · kapi1944 | 0/0 | A | [#5](https://github.com/kapi1944/Ultimate_Pomagier/pull/5) | Baza audytu i cel integracji. |
| `naprawa/porzadek-i-zatwierdzanie-parsowania` | `f8e2deb4dc5b912b2c1767dd02c0ec77129abd9b` | 2026-07-14 · kapi1944 | 271/1 | A | — | Odpowiednik patcha `aa11699`. Przycisk zatwierdzania i porządek plików są w bazie audytu. |
| `naprawa/prawy-panel-czysty-pr` | `78d53b99e5b4711e461e513bbb6130845b2cc5d2` | 2026-07-13 · kapi1944 | 278/0 | A | — | Układ prawego panelu Szczegółów. |
| `naprawa/wspolne-kopie-robocze-generatorow` | `bfbc664409e3c1a652ba0d4ee4dd0f8307a6ee25` | 2026-07-14 · kapi1944 | 269/0 | A | — | Poprawka uruchamiania po migracji kopii. |
| `testy/odbior-windows-4.1.0` | `61062cc2ab5f90b9f56e9c15c7d15bfd79f0e232` | 2026-11-15 · Kapi | 0/10 | C | — | C względem bazy. Odzyskano testy migracji Windows i Androida oraz oddzielny, parametryzowany workflow. |
| `ux/panel-jakosci-responsywnosc` | `aaba4998e20ced18abc890df1983ffd165cbe08c` | 2026-11-07 · Kapi | 22/2 | A | [#3](https://github.com/kapi1944/Ultimate_Pomagier/pull/3) | Kod i pomiary zintegrowane przez `45f40d6`, późniejsza obsługa skali 130% przez `d27dc69`. PR #3 otwarty, jego pierwotne CI i Windows zakończyły się sukcesem. |
| `wydanie/4.1.0` | `692dfbfe6800f635d1ba28273473be6a46792572` | 2026-11-15 · Kapi | 1/0 | A | [#5](https://github.com/kapi1944/Ultimate_Pomagier/pull/5) | Wersja 4.1.0 i dokumentacja aktualizacji. |

### Pliki względem wspólnego przodka

<details>
<summary>archive/stash-2026-11-14-0</summary>

Wspólny przodek `d68f748468c69d80ce872c71749fd9cd1c3ae9ae`.

- M `src/moduly/dokumenty/generatory/programy_szkolen/WidokProgramowSzkolen.tsx`
- M `src/moduly/dokumenty/generatory/programy_szkolen/modelProgramuSzkolenia.ts`
- M `src/moduly/dokumenty/generatory/programy_szkolen/presetyProgramu.ts`
- M `testy/presetyProgramu.test.ts`

</details>

<details>
<summary>archive/stash-2026-11-14-1</summary>

Wspólny przodek `d68f748468c69d80ce872c71749fd9cd1c3ae9ae`.

- M `package.json`
- M `src-tauri/Cargo.toml`
- M `src-tauri/src/pakiety_pdf.rs`
- M `src-tauri/src/zapis_pdf.rs`

</details>

<details>
<summary>archive/stash-2026-11-14-2</summary>

Wspólny przodek `d68f748468c69d80ce872c71749fd9cd1c3ae9ae`.

- M `src/wspolne/dokumenty/pakietyDoZatwierdzenia/modelPakietu.ts`
- M `src/wspolne/dokumenty/pakietyDoZatwierdzenia/przygotujPakiet.ts`
- M `testy/wyborPakietuPdf.test.ts`

</details>

<details>
<summary>archive/stash-2026-11-14-3</summary>

Wspólny przodek `d68f748468c69d80ce872c71749fd9cd1c3ae9ae`.

- M `.github/workflows/ci.yml`
- M `docs/v4/manifest-widokow.json`
- M `docs/v4/rejestr-widokow.md`
- M `src/moduly/dokumenty/generatory/programy_szkolen/WidokProgramowSzkolen.tsx`
- M `src/moduly/dokumenty/generatory/programy_szkolen/modelProgramuSzkolenia.ts`
- M `src/moduly/dokumenty/generatory/programy_szkolen/presetyProgramu.ts`
- M `src/moduly/zamkniete/szczegoly_organizacyjne/komponenty/PanelWykrytychProblemow.tsx`
- M `src/moduly/zamkniete/szczegoly_organizacyjne/widoki/WidokNowychSzczegolowOrganizacyjnych.tsx`
- M `src/moduly/zamkniete/szczegoly_organizacyjne/widoki/widokNowychSzczegolowOrganizacyjnych.css`
- M `testy/checklistaPublikacji.regresja.test.ts`
- M `testy/paneleBoczne.przegladarka.test.mjs`
- M `testy/presetyProgramu.test.ts`
- M `testy/wydajnoscSzczegolow.przegladarka.test.mjs`

</details>

<details>
<summary>archive/stash-2026-11-14-4</summary>

Wspólny przodek `b51e9de485624e080f076195d4c4c0dfcf998f68`.

- M `src/moduly/dokumenty/generatory/programy_szkolen/WidokProgramowSzkolen.tsx`
- M `src/moduly/dokumenty/generatory/programy_szkolen/modelProgramuSzkolenia.ts`
- M `src/moduly/dokumenty/generatory/programy_szkolen/presetyProgramu.ts`
- M `testy/pakietyPdf.przegladarka.test.mjs`
- M `testy/presetyProgramu.test.ts`

</details>

<details>
<summary>etap-4c/domkniecie-dynamicznych-pol-i-walidacji</summary>

Wspólny przodek `2df94c3b87b8e63b9332f051457b68c798486380`.

- M `package.json`
- M `src/moduly/zamkniete/szczegoly_organizacyjne/hooki/useGeneratorSzczegolow.ts`
- M `src/moduly/zamkniete/szczegoly_organizacyjne/komponenty/KartaGrupySzkoleniowej.tsx`
- M `src/moduly/zamkniete/szczegoly_organizacyjne/logikaGrupSzkoleniowych.ts`
- M `src/moduly/zamkniete/szczegoly_organizacyjne/logikaPolDynamicznych.ts`
- M `testy/grupySzkoleniowe.regresja.test.ts`

</details>

<details>
<summary>g1a/programy-wzorce-semper-czysta</summary>

Wspólny przodek `a1297852550113da6fc22610fb824ad2db96f13f`.

- A `src/moduly/dokumenty/generatory/programy_szkolen/RendererStronSemper.tsx`
- M `src/moduly/dokumenty/generatory/programy_szkolen/WidokProgramowSzkolen.tsx`
- A `src/moduly/dokumenty/generatory/programy_szkolen/presetyProgramu.ts`
- A `src/moduly/dokumenty/generatory/programy_szkolen/zasoby/logotyp-semper.png`
- A `src/moduly/dokumenty/generatory/programy_szkolen/zasoby/mapa-polski-semper.png`
- A `testy/presetyProgramu.test.ts`

</details>

<details>
<summary>naprawa/porzadek-i-zatwierdzanie-parsowania</summary>

Wspólny przodek `0618462f531d59addce163ec9528043df77e9e33`.

- D `historia-wszystkich-galezi.txt`
- D `lista-wszystkich-galezi.txt`
- M `src/moduly/dokumenty/generatory/programy_szkolen/WidokProgramowSzkolen.tsx`
- D `Artefakt terminala z powtarzającym się fragmentem OB`

</details>

<details>
<summary>testy/odbior-windows-4.1.0</summary>

Wspólny przodek `b4f96c00e55878ed01ae372a818c157fe8555d1f`.

- M `.github/workflows/desktop-windows.yml`
- A `testy/aktualizacjaAndroid.natywna.py`
- A `testy/aktualizacjaWindows.natywna.test.mjs`

</details>

<details>
<summary>ux/panel-jakosci-responsywnosc</summary>

Wspólny przodek `d68f748468c69d80ce872c71749fd9cd1c3ae9ae`.

- M `.github/workflows/ci.yml`
- M `docs/v4/manifest-widokow.json`
- M `docs/v4/rejestr-widokow.md`
- M `src/moduly/zamkniete/szczegoly_organizacyjne/komponenty/PanelWykrytychProblemow.tsx`
- M `src/moduly/zamkniete/szczegoly_organizacyjne/widoki/WidokNowychSzczegolowOrganizacyjnych.tsx`
- M `src/moduly/zamkniete/szczegoly_organizacyjne/widoki/widokNowychSzczegolowOrganizacyjnych.css`
- M `testy/checklistaPublikacji.regresja.test.ts`
- M `testy/paneleBoczne.przegladarka.test.mjs`
- M `testy/wydajnoscSzczegolow.przegladarka.test.mjs`

</details>
