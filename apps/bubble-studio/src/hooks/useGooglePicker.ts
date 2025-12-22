import { useState, useEffect } from 'react';

// Global state - shared across all component instances
let isLoading = false;
let isLoaded = false;
let loadPromise: Promise<boolean> | null = null;

/**
 * Custom hook to load and manage Google Picker API
 * Loads the API once globally and shares state across all components
 */
export const useGooglePicker = () => {
  const [apiLoaded, setApiLoaded] = useState(isLoaded);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If already loaded, just update state
    if (isLoaded) {
      setApiLoaded(true);
      return;
    }

    // If currently loading, wait for the existing promise
    if (isLoading && loadPromise) {
      loadPromise.then((loaded) => {
        setApiLoaded(loaded);
        if (!loaded) {
          setError('Failed to load Google Picker API');
        }
      });
      return;
    }

    // Start loading (only happens once globally)
    isLoading = true;
    loadPromise = loadGooglePickerApi();

    loadPromise
      .then((loaded) => {
        isLoaded = loaded;
        isLoading = false;
        setApiLoaded(loaded);
        if (!loaded) {
          setError('Failed to load Google Picker API');
        }
      })
      .catch((err) => {
        isLoading = false;
        setError(err.message);
        setApiLoaded(false);
      });
  }, []);

  return { apiLoaded, error };
};

/**
 * Load Google Picker API
 * This function loads the required scripts and initializes the Picker library
 */
async function loadGooglePickerApi(): Promise<boolean> {
  try {
    // Check if already loaded
    if (window.gapi && window.google?.picker) {
      console.log('✅ Google Picker API already loaded');
      return true;
    }

    // Load Google API client if not already loaded
    if (!window.gapi) {
      await loadScript('https://apis.google.com/js/api.js');
      console.log('✅ Loaded gapi script');
    }

    // Load Google Sign-In if not already loaded
    if (!window.google) {
      await loadScript('https://accounts.google.com/gsi/client');
      console.log('✅ Loaded Google Sign-In script');
    }

    // Wait for gapi to be ready
    await new Promise<void>((resolve) => {
      if (window.gapi) {
        resolve();
      } else {
        // Retry a few times
        let attempts = 0;
        const interval = setInterval(() => {
          if (window.gapi || attempts++ > 20) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      }
    });

    // Load the Picker library
    await new Promise<void>((resolve, reject) => {
      window.gapi.load('picker', {
        callback: () => {
          console.log('✅ Loaded Google Picker library');
          resolve();
        },
        onerror: () => {
          console.error('❌ Failed to load Google Picker library');
          reject(new Error('Failed to load Picker library'));
        },
        timeout: 10000, // 10 second timeout
        ontimeout: () => {
          console.error('❌ Timeout loading Google Picker library');
          reject(new Error('Timeout loading Picker library'));
        },
      });
    });

    // Verify picker is available
    if (!window.google?.picker) {
      throw new Error(
        'Picker library loaded but window.google.picker is undefined'
      );
    }

    console.log('✅ Google Picker API fully loaded and ready');
    return true;
  } catch (error) {
    console.error('❌ Error loading Google Picker API:', error);
    return false;
  }
}

/**
 * Load a script dynamically
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script already exists
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}
