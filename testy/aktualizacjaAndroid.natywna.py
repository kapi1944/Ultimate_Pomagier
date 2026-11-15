from pathlib import Path
import os
import re
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
    return znajdz(lambda elementy: next((e for e in elementy if nazwa in etykiety(e)), None))


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


def instaluj(wersja, kod, aktualizacja=False):
    pliki = list((KATALOG / wersja).rglob("*.apk"))
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


assert os.environ.get("GITHUB_ACTIONS") == "true"
assert "arm64-v8a" in adb("shell", "getprop", "ro.product.cpu.abilist").split(",")
instaluj("4.0.0", 4000000)
otworz()
po_tekscie("Pierwsza konfiguracja konta lokalnego")
uzupelnij(["Osoba", "Testowa", LOGIN, HASLO, HASLO])
kliknij(po_tekscie("Zapamiętaj login"))
kliknij(po_tekscie("Utwórz konto lokalne"))
po_tekscie("Pulpit")
print("Android 4.0.0: utworzono konto demonstracyjne i zapisano login.", flush=True)
adb("shell", "am", "force-stop", PAKIET)

instaluj("4.1.0", 4001000, aktualizacja=True)
for proba in range(2):
    otworz()
    po_tekscie("Logowanie lokalne")
    znajdz(lambda elementy: next((e for e in elementy if e.get("class") == "android.widget.EditText"
                                  and LOGIN in etykiety(e)), None))
    uzupelnij([None, HASLO])
    kliknij(po_tekscie("Zaloguj"))
    po_tekscie("Pulpit")
    print(f"Android 4.1.0, uruchomienie {proba + 1}: zachowane konto i zapamiętany login.", flush=True)
    adb("shell", "am", "force-stop", PAKIET)
