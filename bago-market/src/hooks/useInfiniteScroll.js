import { useState, useEffect, useCallback, useRef } from 'react';

export function useInfiniteScroll(fetchFn, options = {}) {
  const { threshold = 200, initialPage = 1 } = options;
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const observerRef = useRef(null);

  const loadMore = useCallback(async (pageNum = page, reset = false) => {
    if (loading || (!hasMore && !reset)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFn(pageNum);
      if (reset) {
        setItems(data.items);
      } else {
        setItems(prev => [...prev, ...data.items]);
      }
      setHasMore(data.hasMore);
      setPage(pageNum + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, page, loading, hasMore]);

  const reset = useCallback(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, []);

  const lastElementRef = useCallback((node) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    }, { rootMargin: `${threshold}px` });
    if (node) observerRef.current.observe(node);
  }, [loading, hasMore, loadMore, threshold]);

  return { items, loading, hasMore, error, lastElementRef, loadMore, reset, setItems };
}
