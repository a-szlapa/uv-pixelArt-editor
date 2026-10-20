/// <reference types="vite/client" />

type DesktopMenuAction =
  | "import-reference"
  | "import-anim-strip"
  | "resize-left"
  | "resize-right"
  | "zoom-left-in"
  | "zoom-left-out"
  | "zoom-left-reset"
  | "zoom-right-in"
  | "zoom-right-out"
  | "zoom-right-reset";

interface Window {
  desktop?: {
    platform: string;
    getAppName: () => string;
    importReference: () => Promise<{name: string; dataUrl: string} | null>;
    onMenuAction: (callback: (action: DesktopMenuAction) => void) => () => void;
    importAnimStrip: () => Promise<{
      name: string;
      dataUrl: string;
    } | null>;
  };
}
