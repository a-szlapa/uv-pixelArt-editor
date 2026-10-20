
const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

const isDev = !app.isPackaged;
let mainWindow = null;

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
          label: "Import",
          submenu: [
            {
              label: "Reference PNG…",
              accelerator: "CmdOrCtrl+O",
              click: () => sendMenuAction("import-reference"),
            },
            {
              label: "Anim Strip…",
              click: () => sendMenuAction("import-anim-strip"),
            },
          ],
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

async function readPngDialog(title) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    properties: ["openFile"],
    filters: [{ name: "PNG Images", extensions: ["png"] }],
  });

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  const filePath = result.filePaths[0];
  const bytes = await fs.readFile(filePath);

  return {
    name: path.basename(filePath),
    dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
  };
}

ipcMain.handle("dialog:import-reference", async () => {
  return readPngDialog("Import Reference PNG");
});

ipcMain.handle("dialog:import-anim-strip", async () => {
  return readPngDialog("Import Animation Strip");
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
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
