const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

const isDev = !app.isPackaged;
let mainWindow;

function sendMenuAction(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("menu-action", action);
  }
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Import Reference Image…",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuAction("import-reference"),
        },
        { type: "separator" },
        { role: "close", label: "Close Window" },
        ...(process.platform === "darwin" ? [] : [{ role: "quit" }]),
      ],
    },
    {
      label: "Canvas",
      submenu: [
        {
          label: "Resize Left Canvas…",
          click: () => sendMenuAction("resize-left"),
        },
        {
          label: "Resize Right Canvas…",
          click: () => sendMenuAction("resize-right"),
        },
        { type: "separator" },
        {
          label: "Zoom Left In",
          accelerator: "CmdOrCtrl+=",
          click: () => sendMenuAction("zoom-left-in"),
        },
        {
          label: "Zoom Left Out",
          accelerator: "CmdOrCtrl+-",
          click: () => sendMenuAction("zoom-left-out"),
        },
        {
          label: "Reset Left Zoom",
          accelerator: "CmdOrCtrl+0",
          click: () => sendMenuAction("zoom-left-reset"),
        },
        { type: "separator" },
        {
          label: "Zoom Right In",
          accelerator: "CmdOrCtrl+Shift+=",
          click: () => sendMenuAction("zoom-right-in"),
        },
        {
          label: "Zoom Right Out",
          accelerator: "CmdOrCtrl+Shift+-",
          click: () => sendMenuAction("zoom-right-out"),
        },
        {
          label: "Reset Right Zoom",
          accelerator: "CmdOrCtrl+Shift+0",
          click: () => sendMenuAction("zoom-right-reset"),
        },
      ],
    },
    { role: "editMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("dialog:import-reference", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import Reference Image",
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  const extension = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
  };
  const bytes = await fs.readFile(filePath);
  return {
    name: path.basename(filePath),
    dataUrl: `data:${mimeTypes[extension] || "application/octet-stream"};base64,${bytes.toString("base64")}`,
  };
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    title: "Pixel Editor",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  createMenu();

  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
