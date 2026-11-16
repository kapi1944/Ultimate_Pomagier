type UstawieniaPrzygotowaniaEksportu<Wynik> = {
  przygotuj?: () => void | Promise<void>
  wykonaj: () => Wynik | Promise<Wynik>
  zakoncz?: () => void
}

export async function wykonajEksportPoPrzygotowaniu<Wynik>({ przygotuj, wykonaj, zakoncz }: UstawieniaPrzygotowaniaEksportu<Wynik>) {
  try {
    await przygotuj?.()
    return await wykonaj()
  } finally {
    zakoncz?.()
  }
}
