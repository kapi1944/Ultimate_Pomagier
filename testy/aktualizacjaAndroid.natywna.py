from pathlib import Path
import os
import re
import shlex
import subprocess
import time
from xml.etree import ElementTree

PAKIET = "pl.ultimatepomagier.desktop"
KATALOG = Path("tmp/odbior-android")
LOGIN = "odbior410"
HASLO = "SyntetycznyOdbior410"


def adb(*argumenty):
    return subprocess.check_output(["adb", *argumenty], text=True, timeout=100).strip()


def ekran():
    adb("shell", "uiautomator", "dump", "/sdcard/odbior-pomagiera.xml")
    xml = adb("shell", "cat", "/sdcard/odbior-pomagiera.xml")
    return list(ElementTree.fromstring(xml).iter("node"))


def etykiety(element):
    return [element.get("text", ""), element.get("content-desc", "")]


def znajdz(warunek):
    blad = None
    for _ in range(10):
        try:
            znaleziony = warunek(ekran())
            if znaleziony is not None:
                return znaleziony
        except (subprocess.SubprocessError, ElementTree.ParseError) as wyjatek:
            blad = wyjatek
        time.sleep(1)
    raise RuntimeError("Nie znaleziono oczekiwanego elementu aplikacji") from blad


def po_tekscie(nazwa):
    return znajdz(lambda elementy: next((e for e in elementy
                                         if nazwa.casefold() in [etykieta.casefold() for etykieta in etykiety(e)]), None))


def kliknij(element):
    lewo, gora, prawo, dol = (int(liczba) for liczba in re.findall(r"\d+", element.get("bounds", "")))
    assert prawo > lewo and dol > gora
    adb("shell", "input", "tap", str((lewo + prawo) // 2), str((gora + dol) // 2))


def uzupelnij(wartosci):
    def pola(elementy):
        edytowalne = [e for e in elementy if e.get("class") == "android.widget.EditText"]
        return edytowalne if len(edytowalne) == len(wartosci) else None

    for indeks, tresc in enumerate(wartosci):
        if tresc:
            kliknij(znajdz(pola)[indeks])
            adb("shell", "input", "text", tresc)


def instaluj(rola, wersja, aktualizacja=False):
    wersja_glowna, wersja_poboczna, poprawka = map(int, wersja.split("."))
    kod = wersja_glowna * 1_000_000 + wersja_poboczna * 1_000 + poprawka
    pliki = list((KATALOG / rola).rglob("*.apk"))
    assert len(pliki) == 1
    opcje = ["-r"] if aktualizacja else []
    assert "Success" in adb("install", *opcje, "--abi", "arm64-v8a", str(pliki[0]))
    informacje = adb("shell", "dumpsys", "package", PAKIET)
    assert f"versionCode={kod} " in informacje
    assert f"versionName={wersja}" in informacje


def otworz():
    dzialanie = adb("shell", "cmd", "package", "resolve-activity", "--brief", "-c",
                    "android.intent.category.LAUNCHER", PAKIET).splitlines()[-1]
    assert dzialanie.startswith(f"{PAKIET}/")
    assert "Status: ok" in adb("shell", "am", "start", "-W", "-n", dzialanie)


def sprawdz_eksport_pdf():
    for nazwa in ("Otwórz menu", "Dokumenty", "Karta na drzwi", "Nowa karta na drzwi"):
        kliknij(po_tekscie(nazwa))
    po_tekscie("Zestaw i karta")
    pole_tytulu = znajdz(lambda elementy: next((e for e in elementy
                                               if e.get("class") == "android.widget.EditText"), None))
    kliknij(pole_tytulu)
    adb("shell", "input", "text", "TestowaKartaOdbior410")
    kliknij(po_tekscie("Zapisz"))
    po_tekscie("Zestaw zapisano w rejestrze dokumentów.")
    print("Karty na drzwi: otwarto generator i zapisano kartę testową.", flush=True)
    def pliki_pdf():
        return {nazwa for nazwa in adb("shell", "ls", "-1", "/sdcard/Download").splitlines()
                if nazwa.lower().endswith(".pdf")}

    zastane = pliki_pdf()
    kliknij(po_tekscie("PDF wybranej karty"))

    def znajdz_akcje(elementy):
        for element in elementy:
            opis = " ".join(etykiety(element))
            if "Nie udało się" in opis and "PDF" in opis:
                raise RuntimeError(opis)
            if "Krótka nazwa pliku" in opis:
                return "nazwa"
            if element.get("resource-id", "").endswith(":id/action_menu_save"):
                return element
        return None

    akcja = znajdz(znajdz_akcje)
    if akcja == "nazwa":
        kliknij(po_tekscie("Krótka nazwa pliku"))
        adb("shell", "input", "text", "KartaOdbior410")
        kliknij(po_tekscie("Pobierz PDF"))
        akcja = znajdz(lambda elementy: next((e for e in elementy
                                             if e.get("resource-id", "").endswith(":id/action_menu_save")), None))
    kliknij(akcja)
    po_tekscie("Zapisano PDF w wybranej lokalizacji.")
    nowe = pliki_pdf() - zastane
    assert len(nowe) == 1, f"Oczekiwano jednego nowego PDF w Download, znaleziono: {nowe}"
    nazwa = nowe.pop()
    assert "karta" in nazwa.casefold(), nazwa
    sciezka = shlex.quote(f"/sdcard/Download/{nazwa}")
    assert adb("shell", f"head -c 5 {sciezka}") == "%PDF-"
    assert adb("shell", f"tail -c 16 {sciezka}").endswith("%%EOF")
    print("Karty na drzwi: zapisano rzeczywisty plik PDF.", flush=True)


assert os.environ.get("GITHUB_ACTIONS") == "true"
assert "arm64-v8a" in adb("shell", "getprop", "ro.product.cpu.abilist").split(",")
wersja_bazowa = os.environ["POMAGIER_WERSJA_BAZOWA"]
wersja_odbierana = os.environ["POMAGIER_WERSJA_ODBIERANA"]
instaluj("bazowa", wersja_bazowa)
otworz()
po_tekscie("Pierwsza konfiguracja konta lokalnego")
uzupelnij(["Osoba", "Testowa", LOGIN, HASLO, HASLO])
kliknij(po_tekscie("Zapamiętaj login"))
kliknij(po_tekscie("Utwórz konto lokalne"))
po_tekscie("Pulpit")
print(f"Android {wersja_bazowa}: utworzono konto demonstracyjne i zapisano login.", flush=True)
adb("shell", "am", "force-stop", PAKIET)

instaluj("odbierana", wersja_odbierana, aktualizacja=True)
for proba in range(2):
    otworz()
    po_tekscie("Logowanie lokalne")
    znajdz(lambda elementy: next((e for e in elementy if e.get("class") == "android.widget.EditText"
                                  and LOGIN in etykiety(e)), None))
    uzupelnij([None, HASLO])
    kliknij(po_tekscie("Zaloguj"))
    po_tekscie("Pulpit")
    print(f"Android {wersja_odbierana}, uruchomienie {proba + 1}: zachowane konto i zapamiętany login.", flush=True)
    if proba == 1:
        sprawdz_eksport_pdf()
    adb("shell", "am", "force-stop", PAKIET)
