// src/utils/apiResponseHandler.ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

/**
 * Handle API responses consistently
 * @param promise - Promise from an API call
 * @returns Standardized API response
 */
export const handleApiResponse = async <T>(
  promise: Promise<T>
): Promise<ApiResponse<T>> => {
  try {
    const data = await promise;
    return {
      success: true,
      data,
      status: 200
    };
  } catch (error: any) {
    // Extract error message from different error formats
    const errorMessage = 
      error.response?.data?.error ||
      error.message ||
      'An unknown error occurred';
    
    // Get status code if available
    const status = error.response?.status || 500;
    
    return {
      success: false,
      error: errorMessage,
      status
    };
  }
};

/**
 * Check if user is authenticated
 * @returns Authentication status and token
 */
export const checkAuthentication = (): { isAuthenticated: boolean; token: string | null } => {
  const token = localStorage.getItem('token');
  return {
    isAuthenticated: !!token,
    token
  };
};

export default {
  handleApiResponse,
  checkAuthentication
};