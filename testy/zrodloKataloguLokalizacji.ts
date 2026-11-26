import { readFileSync } from 'node:fs'

/** Źródło katalogu lokalizacji dla testów w Node: czyta wygenerowane pliki statyczne z `public/dane/lokalizacje`. */
export async function zrodloKataloguZDysku(nazwaPliku: string): Promise<unknown> {
  return JSON.parse(readFileSync(new URL(`../public/dane/lokalizacje/${nazwaPliku}`, import.meta.url), 'utf8'))
}

/** Odczyt zliczający pobrane pliki, aby testy mogły sprawdzić, że województwa są ładowane na żądanie. */
export function utworzZrodloZLicznikiem() {
  const pobrane: string[] = []
  return {
    pobrane,
    zrodlo: async (nazwaPliku: string) => {
      pobrane.push(nazwaPliku)
      return zrodloKataloguZDysku(nazwaPliku)
    },
  }
}
