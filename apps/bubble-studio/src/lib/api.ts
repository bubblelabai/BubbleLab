import { refreshToken } from './token-refresh';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../env';

export interface ApiError {
  status: number;
  data: unknown;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  // Extract a human-friendly message from various error payload shapes
  private extractErrorMessage(errorData: unknown): string {
    if (typeof errorData === 'string') return errorData;
    if (!errorData || typeof errorData !== 'object') return 'Request failed';
    const data = errorData as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    // Direct
    const direct = str(data.message) || str(data.error) || str(data.detail);
    if (direct) return direct;
    // Nested data
    const nestedData = data.data as Record<string, unknown> | undefined;
    if (nestedData && typeof nestedData === 'object') {
      const nestedMsg =
        str(nestedData.message) ||
        str(nestedData.error) ||
        str(nestedData.detail);
      if (nestedMsg) return nestedMsg;
    }
    // Arrays
    const errors = data.errors as unknown;
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0];
      if (typeof first === 'string') return first;
      if (
        first &&
        typeof first === 'object' &&
        typeof first.message === 'string'
      ) {
        return first.message as string;
      }
    }
    try {
      return JSON.stringify(errorData);
    } catch {
      return 'Request failed';
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Get fresh token from Clerk on every request
    // This ensures we always have a valid, non-expired token

    console.log('Making request to', endpoint);
    const token = await refreshToken();

    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      // Handle authentication errors
      if (response.status === 401) {
        let errorData: unknown;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }

        const backendMessage = this.extractErrorMessage(errorData);
        const message =
          backendMessage || 'Authentication failed - please log in again';

        console.error('Authentication failed - user may need to log in again');
        toast.error(message, {
          autoClose: 4000,
        });
        throw new Error(message);
      }

      // Handle other HTTP errors
      if (!response.ok) {
        let errorData: unknown;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }

        const apiError: ApiError = {
          status: response.status,
          data: errorData,
        };

        console.error('API Error:', apiError);
        try {
          // Suppress toast for 404
          if (response.status !== 404) {
            const message = this.extractErrorMessage(errorData);
            toast.error(message || 'Request failed', {
              autoClose: 5000,
            });
          }
        } catch {
          if (response.status !== 404) {
            toast.error('Request failed', { autoClose: 5000 });
          }
        }
        throw new Error(
          `HTTP ${response.status}: ${JSON.stringify(errorData)}`
        );
      }

      // Handle successful responses
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else {
        return (await response.text()) as T;
      }
    } catch (error) {
      if (error instanceof Error) {
        // Avoid duplicate toasts if already shown above
        if (
          !/Authentication failed/.test(error.message) &&
          !/^HTTP \d+/.test(error.message)
        ) {
          toast.error(error.message || 'Network error', { autoClose: 5000 });
        }
        throw error;
      }
      const msg = `Network error: ${String(error)}`;
      toast.error(msg, { autoClose: 5000 });
      throw new Error(msg);
    }
  }

  // Streaming request for Server-Sent Events
  async makeStreamingRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await refreshToken();

    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

    if (response.status === 401) {
      toast.error('Authentication failed - please log in again', {
        autoClose: 4000,
      });
      throw new Error('Authentication failed - please log in again');
    }

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      try {
        console.log('Error data:', errorData);
        if (response.status !== 404) {
          const message = this.extractErrorMessage(errorData);
          toast.error(message || 'Request failed', {
            autoClose: 5000,
          });
        }
      } catch {
        if (response.status !== 404) {
          toast.error('Request failed', { autoClose: 5000 });
        }
      }
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }

    return response;
  }

  // HTTP methods
  async get<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }

  // Streaming POST
  async postStream(
    endpoint: string,
    data?: unknown,
    options?: { signal?: AbortSignal }
  ): Promise<Response> {
    return this.makeStreamingRequest(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      signal: options?.signal,
    });
  }
}

// Create API client instance
export const api = new ApiClient(API_BASE_URL);
