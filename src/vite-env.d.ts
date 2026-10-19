/// <reference types="vite/client" />

interface Window {
  desktop?: {
    platform: string;
    getAppName: () => string;
  };
}