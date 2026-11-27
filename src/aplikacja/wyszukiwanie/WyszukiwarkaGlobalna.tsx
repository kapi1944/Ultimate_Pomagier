import IkonaMenu, { type TypIkonyMenu } from '../menu/IkonaMenu'
import type { Uzytkownik } from '../../kartoteki/uzytkownicy/typyUzytkownikow'
import { useEffect, useId, useRef, useState } from 'react'
import { useKontekstUzytkownika } from '../logowanie/useKontekstUzytkownika'
import { pobierzHistorieWyszukiwania, type WynikWyszukiwania } from './mechanizmWyszukiwania'
import { wyszukiwarkaGlobalna } from './zrodlaWyszukiwania'
import './wyszukiwarkaGlobalna.css'

type StanWynikow = Awaited<ReturnType<typeof wyszukiwarkaGlobalna.szukaj>> & { fraza: string; trwa: boolean; konto: Uzytkownik | null }
const pustyStan: StanWynikow = { grupy: [], bledy: [], ograniczonyDostep: false, fraza: '', trwa: true, konto: null }

function Lupa() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg>
}
const ikony: Record<string, TypIkonyMenu> = { Szkolenia: 'szkolenia', Klienci: 'kartoteki', Trenerzy: 'obecnosc', Dokumenty: 'dokumenty', 'Zadania i terminarz': 'pulpit', Magazyn: 'zakupy', 'Moduły i funkcje': 'wszystkie', 'Szybkie polecenia': 'nowy' }

export default function WyszukiwarkaGlobalna({ otworzWynik }: { otworzWynik: (wynik: WynikWyszukiwania) => Promise<boolean> }) {
  const { zalogowanyUzytkownik } = useKontekstUzytkownika()
  const [fraza, ustawFraze] = useState('')
  const [otwarta, ustawOtwarta] = useState(false)
  const [stan, ustawStan] = useState(pustyStan)
  const [aktywny, ustawAktywny] = useState(-1)
  const [bladOtwarcia, ustawBladOtwarcia] = useState('')
  const [otwieranie, ustawOtwieranie] = useState(false)
  const kontener = useRef<HTMLDivElement>(null)
  const pole = useRef<HTMLInputElement>(null)
  const przyciskMobilny = useRef<HTMLButtonElement>(null)
  const pominOtwarciePoFocusie = useRef(false)
  const id = useId()
  const aktualne = stan.konto === zalogowanyUzytkownik && stan.fraza === fraza && !stan.trwa
  const wyniki = aktualne ? stan.grupy.flatMap((grupa) => grupa.wyniki) : []

  function zamknij(przywrocFocus = false) {
    ustawOtwarta(false)
    if (przywrocFocus) {
      if (window.matchMedia('(max-width: 760px)').matches) przyciskMobilny.current?.focus()
      else {
        pominOtwarciePoFocusie.current = true
        pole.current?.focus()
        pominOtwarciePoFocusie.current = false
      }
    }
  }
  useEffect(() => {
    function skrot(zdarzenie: KeyboardEvent) {
      if ((zdarzenie.ctrlKey || zdarzenie.metaKey) && zdarzenie.key.toLowerCase() === 'k') {
        if (document.querySelector('dialog[open], [aria-modal="true"]')) return
        zdarzenie.preventDefault()
        if (!otwarta) ustawStan(pustyStan)
        ustawOtwarta(true)
        requestAnimationFrame(() => { pole.current?.focus(); pole.current?.select() })
      }
    }
    function pozaPanelem(zdarzenie: PointerEvent) {
      if (zdarzenie.target instanceof Node && !kontener.current?.contains(zdarzenie.target)) ustawOtwarta(false)
    }
    window.addEventListener('keydown', skrot)
    document.addEventListener('pointerdown', pozaPanelem)
    return () => { window.removeEventListener('keydown', skrot); document.removeEventListener('pointerdown', pozaPanelem) }
  }, [otwarta])
  useEffect(() => {
    if (!otwarta || !zalogowanyUzytkownik) return
    const kontroler = new AbortController()
    const opoznienie = window.setTimeout(async () => {
      try {
        const wynik = await wyszukiwarkaGlobalna.szukaj(fraza, { uzytkownik: zalogowanyUzytkownik, sygnal: kontroler.signal }, pobierzHistorieWyszukiwania(zalogowanyUzytkownik.id))
        if (!kontroler.signal.aborted) ustawStan({ ...wynik, fraza, trwa: false, konto: zalogowanyUzytkownik })
      } catch {
        if (!kontroler.signal.aborted) ustawStan({ ...pustyStan, fraza, trwa: false, konto: zalogowanyUzytkownik, bledy: ['Wyszukiwanie'] })
      }
    }, 200)
    return () => { kontroler.abort(); window.clearTimeout(opoznienie) }
  }, [otwarta, fraza, zalogowanyUzytkownik])

  async function wybierz(wynik: WynikWyszukiwania) {
    if (otwieranie) return
    ustawOtwieranie(true)
    try {
      if (await otworzWynik(wynik)) { zamknij(); ustawFraze(''); ustawStan(pustyStan) }
      else ustawBladOtwarcia('Rekord jest niedostępny lub nie masz uprawnień. Wyszukaj ponownie.')
    } catch { ustawBladOtwarcia('Nie udało się otworzyć wyniku. Spróbuj ponownie.') }
    finally { ustawOtwieranie(false) }
  }

  return <div className={`wyszukiwarka${otwarta ? ' wyszukiwarka--otwarta' : ''}`} ref={kontener}
    onBlur={(zdarzenie) => { if (!zdarzenie.currentTarget.contains(zdarzenie.relatedTarget)) zamknij() }}
    onKeyDown={(zdarzenie) => {
      if (zdarzenie.key === 'Escape') { zdarzenie.preventDefault(); zamknij(true) }
    }}>
    <button className="wyszukiwarka__mobilna" type="button" ref={przyciskMobilny} aria-label="Otwórz wyszukiwarkę" aria-expanded={otwarta} aria-controls={id} onClick={() => { ustawOtwarta(true); requestAnimationFrame(() => pole.current?.focus()) }}><Lupa /></button>
    <div className="wyszukiwarka__obszar">
      <div className="wyszukiwarka__pole"><Lupa /><input ref={pole} aria-label="Szukaj w Pomagierze" placeholder="Szukaj w Pomagierze..." role="combobox" aria-autocomplete="list" aria-expanded={otwarta} aria-controls={id} aria-activedescendant={otwarta && wyniki[aktywny] ? `${id}-${aktywny}` : undefined} aria-describedby={`${id}-pomoc`} autoComplete="off" maxLength={160} value={fraza}
        onFocus={() => { if (!pominOtwarciePoFocusie.current) { if (!otwarta) ustawStan(pustyStan); ustawOtwarta(true) } }} onClick={() => { if (!otwarta) ustawStan(pustyStan); ustawOtwarta(true) }} onChange={(zdarzenie) => { ustawFraze(zdarzenie.target.value); ustawAktywny(-1); ustawStan(pustyStan); ustawBladOtwarcia(''); ustawOtwarta(true) }}
        onKeyDown={(zdarzenie) => {
          if (zdarzenie.nativeEvent.isComposing) return
          if (!otwarta && ['ArrowDown', 'ArrowUp'].includes(zdarzenie.key)) { zdarzenie.preventDefault(); ustawOtwarta(true); return }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(zdarzenie.key) && otwarta && wyniki.length) {
            zdarzenie.preventDefault()
            const nastepny = zdarzenie.key === 'Home' ? 0 : zdarzenie.key === 'End' ? wyniki.length - 1 : (aktywny + (zdarzenie.key === 'ArrowDown' ? 1 : -1) + wyniki.length) % wyniki.length
            ustawAktywny(nastepny)
            document.getElementById(`${id}-${nastepny}`)?.scrollIntoView({ block: 'nearest' })
          }
          if (zdarzenie.key === 'Enter' && otwarta && wyniki[aktywny]) { zdarzenie.preventDefault(); void wybierz(wyniki[aktywny]) }
        }} />
        {fraza ? <button type="button" aria-label="Wyczyść wyszukiwanie" onClick={() => { ustawFraze(''); ustawAktywny(-1); ustawStan(pustyStan); ustawBladOtwarcia(''); pole.current?.focus() }}>×</button> : <kbd aria-hidden="true">Ctrl + K</kbd>}
        <button className="wyszukiwarka__zamknij" type="button" aria-label="Zamknij wyszukiwarkę" onClick={() => zamknij(true)}>×</button>
      </div>
      <small id={`${id}-pomoc`} className="wyszukiwarka__pomoc">Strzałki wybierają wynik, Enter otwiera, Esc zamyka. Wpisz +, aby wybrać polecenie.</small>
      {otwarta && <div className="wyszukiwarka__panel">
        <div role="status" aria-live="polite" className="wyszukiwarka__status">
          {!aktualne ? 'Wyszukiwanie…' : wyniki.length ? `${fraza.trim() ? 'Znalezione wyniki' : 'Ostatnio otwierane'}: ${wyniki.length}` : fraza.trim() ? 'Brak wyników.' : 'Wpisz frazę, aby przeszukać Pomagiera, lub + dla szybkich poleceń.'}
          {aktualne && stan.ograniczonyDostep && <p>Nie masz uprawnień do części funkcji. Pokazujemy wyłącznie dostępne wyniki.</p>}
          {aktualne && stan.bledy.length > 0 && <p role="alert">Nie udało się przeszukać części źródeł. Zmień frazę, aby ponowić wyszukiwanie.</p>}
          {bladOtwarcia && <p role="alert">{bladOtwarcia}</p>}
        </div>
        <div id={id} role="listbox" aria-label="Wyniki wyszukiwania" aria-busy={!aktualne || otwieranie}>
          {aktualne && stan.grupy.map((grupa) => <div key={grupa.kategoria} role="group" aria-label={grupa.kategoria}>
            <h3 aria-hidden="true">{grupa.kategoria}</h3>
            {grupa.wyniki.map((wynik) => {
              const indeks = wyniki.indexOf(wynik)
              return <div key={wynik.id} id={`${id}-${indeks}`} role="option" aria-selected={aktywny === indeks} className="wyszukiwarka__wynik" onPointerDown={(zdarzenie) => zdarzenie.preventDefault()} onClick={() => void wybierz(wynik)}>
                <span aria-hidden="true" className="wyszukiwarka__ikona"><IkonaMenu typ={ikony[wynik.kategoria] ?? 'wszystkie'} /></span><span><strong>{wynik.nazwa}</strong><span>{wynik.opis}</span><small>{wynik.informacje}</small></span><span aria-hidden="true">↵</span>
              </div>
            })}
          </div>)}
        </div>
        <small>Do 5 wyników w każdej kategorii.</small>
      </div>}
    </div>
  </div>
}
