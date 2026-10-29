'use client';
// Client-side loader for the live API routes. Each panel loads on its own, so one slow call never blocks the rest.
import { useEffect, useState } from 'react';

export type Loadable<T> = { data?: T; error?: string };

export function useApi<T>(path: string): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({});
  useEffect(() => {
    let alive = true;
    fetch(path)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? res.statusText);
        if (alive) setState({ data: body as T });
      })
      .catch((err: Error) => alive && setState({ error: err.message }));
    return () => { alive = false; };
  }, [path]);
  return state;
}
