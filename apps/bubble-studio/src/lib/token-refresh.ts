// Global variable to store the getToken function
let getTokenFunction: (() => Promise<string | null>) | null = null;

// Function to set the getToken function from Clerk
export const setGetTokenFunction = (getToken: () => Promise<string | null>) => {
  getTokenFunction = getToken;
};

// Function to check if token function is ready
export const isTokenFunctionReady = (): boolean => {
  return getTokenFunction !== null;
};

// Keep track of the current refresh promise to avoid multiple concurrent refreshes
let currentRefreshPromise: Promise<string | null> | null = null;

// Function to refresh the token
export const refreshToken = async (): Promise<string | null> => {
  if (!getTokenFunction) {
    console.error('getToken function not set - token refresh not available');
    throw new Error(
      'Authentication not initialized - please wait for login to complete'
    );
  }

  // If we're already refreshing, return the existing promise
  if (currentRefreshPromise) {
    return currentRefreshPromise;
  }

  currentRefreshPromise = (async () => {
    try {
      // Clerk's getToken() automatically handles token refresh
      // It returns a fresh token if the current one is expired or about to expire
      const newToken = await getTokenFunction();
      if (newToken) {
        return newToken;
      }
      return null;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    } finally {
      currentRefreshPromise = null;
    }
  })();

  return currentRefreshPromise;
};
