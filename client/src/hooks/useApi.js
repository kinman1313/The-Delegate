// hooks/useApi.js
import { useState, useCallback } from 'react';

/**
 * Custom hook for making API calls with loading and error states
 * @param {Function} apiFunction - The API function to call
 * @returns {Object} - Object containing data, loading state, error, and execute function
 */
const useApi = (apiFunction) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiFunction]);

  return { data, loading, error, execute };
};

export default useApi;