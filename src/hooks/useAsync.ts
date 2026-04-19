import { useState, useEffect } from 'react';

export function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fn(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [fn]);

  return { data, loading, error };
}
