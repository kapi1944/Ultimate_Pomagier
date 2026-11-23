/**
 * Zwraca poprzednią wartość, gdy nowa ma identyczną zawartość. Dzięki temu cykliczny odczyt z magazynu lub sesji
 * (który za każdym razem tworzy nowe obiekty) nie zmienia referencji stanu i nie renderuje ponownie konsumentów kontekstu.
 * Dotyczy wyłącznie danych serializowalnych do JSON (konta użytkowników); przy błędzie serializacji zwraca nową wartość.
 */
export function zachowajReferencjeJesliRowne<T>(poprzednia: T, nastepna: T): T {
  if (Object.is(poprzednia, nastepna)) return poprzednia
  try {
    return JSON.stringify(poprzednia) === JSON.stringify(nastepna) ? poprzednia : nastepna
  } catch {
    return nastepna
  }
}
