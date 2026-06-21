import { useEffect, useRef, useState } from 'react';

/**
 * Persiste o estado de um formulário em localStorage para que o usuário não
 * perca dados ao trocar de aba, recarregar a página ou navegar acidentalmente.
 *
 * Uso:
 *   const [form, setForm] = usePersistedForm('estoque:novo-item', initialState);
 *   // ... ao concluir/cancelar:
 *   clearPersistedForm('estoque:novo-item');
 */
export function usePersistedForm<T>(
  key: string,
  initial: T,
  options?: { debounceMs?: number }
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const storageKey = `vetra:form:${key}`;
  const debounceMs = options?.debounceMs ?? 300;

  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      return { ...(initial as object), ...(parsed as object) } as T;
    } catch {
      return initial;
    }
  });

  const timeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        /* quota / private mode — ignora */
      }
    }, debounceMs);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [state, storageKey, debounceMs]);

  const clear = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* noop */
    }
  };

  return [state, setState, clear];
}

export function clearPersistedForm(key: string) {
  try {
    window.localStorage.removeItem(`vetra:form:${key}`);
  } catch {
    /* noop */
  }
}
