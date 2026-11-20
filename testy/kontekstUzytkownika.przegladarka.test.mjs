import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const wymagaj = createRequire(import.meta.url)
const { chromium } = wymagaj(process.env.POMAGIER_PLAYWRIGHT || 'playwright')
const adres = process.env.POMAGIER_ADRES || 'http://127.0.0.1:5173'
const kluczMagazynuUzytkownikow = 'ultimatePomagier.uzytkownicy.v1'
const zdarzenieZmianyUzytkownikow = 'ultimatePomagier:zmianaUzytkownikow'

function uruchomPrzegladarke() {
  const sciezkaChrome = process.env.POMAGIER_CHROME
  return chromium.launch({ executablePath: sciezkaChrome, channel: sciezkaChrome ? undefined : 'chrome', headless: true })
}

async function poczekajNaSpokoj(strona) {
  let poprzednia = -1
  for (let proba = 0; proba < 40; proba += 1) {
    const biezaca = await strona.evaluate(() => window.__zatwierdzeniaReacta)
    if (biezaca === poprzednia) return biezaca
    poprzednia = biezaca
    await strona.waitForTimeout(700)
  }
  throw new Error('Interfejs nie uspokoił się: renderowania trwają bez przerwy.')
}

test('kontekst użytkownika: odświeżenie sesji bez zmiany danych nie renderuje interfejsu, prawdziwa zmiana odświeża listę', { timeout: 90000 }, async () => {
  const przegladarka = await uruchomPrzegladarke()
  try {
    const strona = await przegladarka.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    // Licznik zatwierdzeń Reacta (commitów) przez minimalny hak narzędzi deweloperskich.
    await strona.addInitScript(() => {
      window.__zatwierdzeniaReacta = 0
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        supportsFiber: true,
        renderers: new Map(),
        inject() { return 1 },
        onScheduleFiberRoot() {},
        onCommitFiberRoot() { window.__zatwierdzeniaReacta += 1 },
        onPostCommitFiberRoot() {},
        onCommitFiberUnmount() {},
        checkDCE() {},
      }
    })
    await strona.goto(adres)
    await strona.getByRole('button', { name: 'Otwórz demonstrację Architekta', exact: true }).click()
    await strona.locator('main.uklad-aplikacji__obszar-roboczy').waitFor()
    const liczbaPoUruchomieniu = await poczekajNaSpokoj(strona)
    assert.ok(liczbaPoUruchomieniu > 0, 'Hak licznika renderowań nie działa.')

    // Odświeżenie sesji zwraca nowy obiekt konta o tej samej zawartości (tak jak cykliczne odświeżanie co 15 s).
    // Wartość kontekstu pobieramy z drzewa Reacta, bo testowana ścieżka nie ma przycisku w interfejsie.
    await strona.evaluate(async () => {
      const korzen = document.getElementById('root')
      const klucz = Object.keys(korzen).find((nazwa) => nazwa.startsWith('__reactContainer$'))
      const szukaj = (wezel) => {
        for (let element = wezel; element; element = element.sibling) {
          const wartosc = element.memoizedProps?.value
          if (wartosc && typeof wartosc.odswiezUzytkownika === 'function') return wartosc
          const znaleziona = szukaj(element.child)
          if (znaleziona) return znaleziona
        }
        return null
      }
      const kontekst = szukaj(korzen[klucz])
      if (!kontekst) throw new Error('Nie znaleziono wartości kontekstu użytkownika.')
      for (let numer = 0; numer < 5; numer += 1) {
        await kontekst.odswiezUzytkownika()
        await new Promise((rozwiaz) => setTimeout(rozwiaz, 50))
      }
      for (let numer = 0; numer < 5; numer += 1) window.dispatchEvent(new Event('ultimatePomagier:zmianaUzytkownikow'))
    })
    await strona.waitForTimeout(800)
    assert.equal(await strona.evaluate(() => window.__zatwierdzeniaReacta), liczbaPoUruchomieniu, 'Odświeżenie sesji i zdarzenia bez zmiany kont nie mogą renderować interfejsu.')

    const zmieniono = await strona.evaluate(({ klucz, nazwa }) => {
      const baza = JSON.parse(localStorage.getItem(klucz) ?? 'null')
      const konto = baza?.uzytkownicy?.find((pozycja) => pozycja.status === 'AKTYWNY' && pozycja.id !== 'administrator-kacper-madej')
      if (!konto) return false
      konto.status = 'NIEAKTYWNY'
      localStorage.setItem(klucz, JSON.stringify(baza))
      window.dispatchEvent(new Event(nazwa))
      return true
    }, { klucz: kluczMagazynuUzytkownikow, nazwa: zdarzenieZmianyUzytkownikow })
    assert.equal(zmieniono, true, 'Brak aktywnego konta pomocniczego do kontroli pozytywnej.')
    await strona.waitForTimeout(800)
    assert.ok(await strona.evaluate(() => window.__zatwierdzeniaReacta) > liczbaPoUruchomieniu, 'Prawdziwa zmiana kont musi odświeżyć interfejs.')
  } finally { await przegladarka.close() }
})
