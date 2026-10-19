const { contextBridge } = require("electron");

// Expose a small, explicit API here when the renderer needs native capabilities.
// Keep Node.js and Electron APIs out of the React renderer.
contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  getAppName: () => ""
});