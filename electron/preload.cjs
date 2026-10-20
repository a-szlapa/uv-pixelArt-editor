
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  getAppName: () => "Pixel Editor",

  importReference: () =>
    ipcRenderer.invoke("dialog:import-reference"),

  importAnimStrip: () =>
    ipcRenderer.invoke("dialog:import-anim-strip"),

  onMenuAction: (callback) => {
    const listener = (_event, action) => callback(action);

    ipcRenderer.on("menu-action", listener);

    return () => {
      ipcRenderer.removeListener("menu-action", listener);
    };
  },
});
