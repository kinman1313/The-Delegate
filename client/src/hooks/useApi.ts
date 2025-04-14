import { useState, useCallback } from 'react';

/**
 * Custom hook for making API calls with loading and error states
 * @param apiFunction - The API function to call
 * @returns Object containing data, loading state, error, and execute function
 */
function useApi<T, Args extends any[]>(
  apiFunction: (...args: Args) => Promise<T>
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: Args) => Promise<T | null>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiFunction(...args);
        setData(result);
        return result;
      } catch (err: any) {
        const errorMessage = err.message || 'An unexpected error occurred';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction]
  );

  return { data, loading, error, execute };
}

export default useApi;