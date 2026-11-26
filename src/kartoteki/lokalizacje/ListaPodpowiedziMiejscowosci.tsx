import { usePodpowiedziMiejscowosci } from './usePodpowiedziMiejscowosci'

type WlasciwosciListyPodpowiedzi = {
  id: string
  fraza: string
}

/** `<datalist>` z podpowiedziami: najpierw nazwy zaczynające się od frazy, po separatorze nazwy, które ją tylko zawierają. */
export function ListaPodpowiedziMiejscowosci({ id, fraza }: WlasciwosciListyPodpowiedzi) {
  const podpowiedzi = usePodpowiedziMiejscowosci(fraza)
  const wpisana = fraza.trim()

  return (
    <datalist id={id}>
      {podpowiedzi.poczatek.map((nazwa) => <option key={`p-${nazwa}`} value={nazwa} />)}
      {podpowiedzi.zawierajace.length > 0 && <option key="separator" value={wpisana} label={`zawierają „${wpisana}” ↓`} />}
      {podpowiedzi.zawierajace.map((nazwa) => <option key={`z-${nazwa}`} value={nazwa} />)}
    </datalist>
  )
}
