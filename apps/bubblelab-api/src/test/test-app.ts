import app from '../index.js';
import { TEST_USER_ID } from './setup.js';

/**
 * Test helper that provides a fetch-like interface for testing the Hono app
 * without needing a running HTTP server
 */
export class TestApp {
  /**
   * Make a request to the Hono app directly
   */
  static async request(
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | object;
    } = {}
  ): Promise<Response> {
    const { method = 'GET', headers = {}, body } = options;

    // Default headers
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'X-User-ID': TEST_USER_ID, // Use dev user ID that matches seeded user
      ...headers,
    };

    // Convert body to string if it's an object
    const bodyString = typeof body === 'object' ? JSON.stringify(body) : body;

    // Create a Request object
    const url = `http://localhost:3001${path}`;
    const request = new Request(url, {
      method,
      headers: defaultHeaders,
      body: bodyString,
    });

    // Call the Hono app directly
    return await app.fetch(request);
  }

  /**
   * Convenience method for GET requests
   */
  static async get(
    path: string,
    headers?: Record<string, string>
  ): Promise<Response> {
    return this.request(path, { method: 'GET', headers });
  }

  /**
   * Convenience method for POST requests
   */
  static async post(
    path: string,
    body?: object | string,
    headers?: Record<string, string>
  ): Promise<Response> {
    return this.request(path, { method: 'POST', body, headers });
  }

  /**
   * Convenience method for PUT requests
   */
  static async put(
    path: string,
    body?: object | string,
    headers?: Record<string, string>
  ): Promise<Response> {
    return this.request(path, { method: 'PUT', body, headers });
  }

  /**
   * Convenience method for DELETE requests
   */
  static async delete(
    path: string,
    headers?: Record<string, string>
  ): Promise<Response> {
    return this.request(path, { method: 'DELETE', headers });
  }
}
