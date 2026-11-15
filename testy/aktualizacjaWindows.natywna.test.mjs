import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn, execFileSync } from 'node:child_process'
import { cp, readFile, readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { setTimeout as odczekaj } from 'node:timers/promises'
import { chromium } from 'playwright'

test('Instalacja Windows 4.0.0 → 4.1.0 zachowuje profil i chroni otwarty formularz', { timeout: 600000 }, async () => {
  assert.equal(process.platform, 'win32')
  assert.equal(process.env.GITHUB_ACTIONS, 'true')
  const katalogDanych = join(process.env.LOCALAPPDATA, 'pl.ultimatepomagier.desktop')
  assert.deepEqual(await readdir(katalogDanych).catch((blad) => {
    if (blad.code === 'ENOENT') return []
    throw blad
  }), [], 'Runner musi mieć pusty profil')
  const instalacja = join(process.env.RUNNER_TEMP, 'Pomagier-odbior-410')
  const aplikacja = join(instalacja, 'ultimate-pomagier.exe')
  const katalogArtefaktow = resolve('tmp/odbior-windows')
  const polaczenia = new Map()
  let proces
  function zainstaluj(wersja, nazwa) {
    execFileSync(join(katalogArtefaktow, wersja, 'podpisane', nazwa), ['/S', `/D=${instalacja}`], { timeout: 180000, windowsHide: true, stdio: 'inherit' })
  }
  function uruchom() {
    proces = spawn(aplikacja, [], { env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=0' }, stdio: 'ignore' })
  }
  async function znajdz(naglowek) {
    const koniec = Date.now() + 60000
    while (Date.now() < koniec) {
      assert.equal(proces.exitCode, null, 'Aplikacja zamknęła się przed otwarciem widoku')
      const pliki = await readdir(katalogDanych, { recursive: true }).catch(() => [])
      for (const plik of pliki.filter((nazwa) => nazwa.endsWith('DevToolsActivePort'))) {
        const port = Number((await readFile(join(katalogDanych, plik), 'utf8').catch(() => '')).split('\n')[0])
        if (!port) continue
        try {
          let polaczenie = polaczenia.get(port)
          if (!polaczenie?.isConnected()) {
            polaczenie = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1200 })
            polaczenia.set(port, polaczenie)
          }
          for (const kontekst of polaczenie.contexts()) for (const strona of kontekst.pages()) {
            if (await strona.getByRole('heading', { name: naglowek, exact: true }).isVisible()) return strona
          }
        } catch { /* Profil WebView2 może jeszcze się uruchamiać. */ }
      }
      await odczekaj(250)
    }
    throw new Error(`Brak natywnego okna z nagłówkiem ${naglowek}`)
  }
  async function zamknij(strona) {
    await strona.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:window|close', { label: 'obszar' })).catch(() => undefined)
  }
  async function czekajNaZamkniecie() {
    for (let proba = 0; proba < 60 && proces.exitCode === null; proba++) await odczekaj(250)
    assert.equal(proces.exitCode, 0, 'Aplikacja powinna zamknąć się poprawnie')
  }
  async function wersja(strona) {
    return strona.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:app|version'))
  }
  const login = 'odbior-wydania'
  const haslo = 'haslo-wylacznie-syntetyczne-410'
  const zadanie = 'Zadanie testowe zapisane w 4.0.0'
  const szkic = 'Szkic testowy utworzony w 4.0.0'
  const sciezkaSzczegolow = '/szkolenia-zamkniete/szczegoly-organizacyjne'
  async function otworzSzczegoly(strona, ekran) {
    await strona.goto(new URL(`${sciezkaSzczegolow}/${ekran}`, strona.url()).href)
  }
  try {
    zainstaluj('4.0.0', 'Ultimate_Pomagier_4.0_Setup.exe')
    uruchom()
    let strona = await znajdz('Pierwsza konfiguracja konta lokalnego')
    await strona.getByLabel('Imię', { exact: true }).fill('Osoba')
    await strona.getByLabel('Nazwisko', { exact: true }).fill('Testowa')
    await strona.getByLabel('Login lub adres e-mail').fill(login)
    await strona.getByLabel('Nowe hasło', { exact: true }).fill(haslo)
    await strona.getByLabel('Powtórz nowe hasło', { exact: true }).fill(haslo)
    await strona.getByRole('button', { name: 'Utwórz konto lokalne', exact: true }).click()
    strona = await znajdz('Pulpit')
    assert.equal(await wersja(strona), '4.0.0')
    await strona.getByRole('button', { name: '+ Dodaj zadanie', exact: true }).click()
    await strona.getByLabel('Nazwa zadania', { exact: true }).fill(zadanie)
    await strona.locator('#pulpit-rodzaj-terminu-zadania').selectOption('BRAK_GODZINY')
    await strona.getByRole('button', { name: 'Zapisz', exact: true }).click()
    await strona.getByText(zadanie, { exact: true }).first().waitFor()
    await otworzSzczegoly(strona, 'nowe')
    const tytul = (widok) => widok.locator('input[id$="tytulSzkolenia"]').first()
    await tytul(strona).fill(szkic)
    await strona.getByRole('button', { name: 'Zapisz wersję roboczą', exact: true }).click()
    await otworzSzczegoly(strona, 'kopie-robocze')
    await strona.getByText(szkic, { exact: true }).waitFor()
    await zamknij(strona)
    await czekajNaZamkniecie()
    const baza = join(katalogDanych, 'konta', 'konta.sqlite3')
    assert.ok((await stat(baza)).size > 0)
    await cp(katalogDanych, join(process.env.RUNNER_TEMP, 'Pomagier-kopia-400'), { recursive: true, errorOnExist: true, force: false })
    console.log('4.0.0: zapisano konto, zadanie i szkic oraz wykonano kopię profilu.')

    zainstaluj('4.1.0', 'Ultimate_Pomagier_4.1.0_Setup.exe')
    for (let powtorzenie = 0; powtorzenie < 2; powtorzenie++) {
      uruchom()
      strona = await znajdz('Logowanie lokalne')
      await strona.getByLabel('Login lub adres e-mail').fill(login)
      await strona.getByLabel('Hasło', { exact: true }).fill(haslo)
      await strona.getByRole('button', { name: 'Zaloguj', exact: true }).click()
      strona = await znajdz('Pulpit')
      assert.equal(await wersja(strona), '4.1.0')
      assert.deepEqual(await strona.evaluate(() => window.__TAURI_INTERNALS__.invoke('informacje_o_platformie')), { system: 'windows', architektura: 'x86_64' })
      assert.equal(await strona.evaluate(() => window.__TAURI_INTERNALS__.invoke('czy_aktualizacje_dostepne')), true)
      await strona.getByText(zadanie, { exact: true }).first().waitFor()
      await otworzSzczegoly(strona, 'kopie-robocze')
      await strona.getByText(szkic, { exact: true }).waitFor()
      console.log(`4.1.0, uruchomienie ${powtorzenie + 1}: logowanie, zadanie i szkic zachowane.`)
      if (powtorzenie === 0) {
        await otworzSzczegoly(strona, 'nowe')
        await tytul(strona).fill('Niezapisana zmiana testowa')
        await strona.waitForFunction(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })))
        await zamknij(strona)
        const dialog = strona.getByRole('dialog', { name: 'Masz niezapisane zmiany' })
        await dialog.getByRole('button', { name: 'ANULUJ', exact: true }).click()
        assert.equal(await tytul(strona).inputValue(), 'Niezapisana zmiana testowa')
        console.log('Anulowanie zamknięcia natywnego okna zachowało edytowaną wartość.')
        await strona.getByRole('button', { name: 'Zapisz wersję roboczą', exact: true }).click()
        await otworzSzczegoly(strona, 'kopie-robocze')
      }
      await zamknij(strona)
      await czekajNaZamkniecie()
    }
  } finally {
    if (proces?.exitCode === null) proces.kill()
    for (const polaczenie of polaczenia.values()) await polaczenie.close().catch(() => undefined)
  }
})
