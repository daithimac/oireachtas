import { useState, useCallback } from 'react';
import { useAsync } from './useAsync';

type PaginatedFetcher<T> = (skip: number, limit: number, signal?: AbortSignal) => Promise<Record<string, T[] | number>>;

export function usePaginatedList<T>(
  fetcher: PaginatedFetcher<T>,
  itemsKey: string,
  pageSize: number
) {
  const [skip, setSkip] = useState(0);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const initialFetcher = useCallback((signal: AbortSignal) =>
    fetcher(0, pageSize, signal).then((result) => {
      setItems(result[itemsKey] as T[]);
      setTotal(result.total as number);
      setSkip(pageSize);
      return result;
    }),
    [fetcher, pageSize, itemsKey]
  );

  const { loading, error } = useAsync(initialFetcher);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const result = await fetcher(skip, pageSize);
      setItems((prev) => [...prev, ...(result[itemsKey] as T[])]);
      setSkip((s) => s + pageSize);
    } finally {
      setLoadingMore(false);
    }
  }, [fetcher, skip, pageSize, itemsKey]);

  return { items, total, loading, error, loadingMore, handleLoadMore };
}
