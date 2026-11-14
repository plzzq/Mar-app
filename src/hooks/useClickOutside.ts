import { useEffect, type RefObject } from "react";

/** Chama `onOutside` ao clicar fora do elemento ou ao pressionar Esc, enquanto `active` for verdadeiro. */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOutside();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onOutside, active]);
}
