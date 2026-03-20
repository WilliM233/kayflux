const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Paths
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'app.db');
const settingsPath = path.join(userDataPath, 'settings.json');
const logPath = path.join(userDataPath, 'kayflux.log');

// Server directory: in production, bundled under resources/server; in dev, parent repo
const serverDir = app.isPackaged
  ? path.join(process.resourcesPath, 'server')
  : path.join(__dirname, '..');

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let serverProcess = null;
let currentState = 'starting';

// --- Settings ---

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {
    log(`Failed to load settings: ${e.message}`);
  }
  return { port: 3030, launchAtLogin: false };
}

function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function getPort() {
  return loadSettings().port || 3030;
}

// --- Logging ---

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logPath, line);
  } catch (_) {
    // ignore write errors
  }
}

// --- Server lifecycle ---

function startServer() {
  const port = getPort();
  currentState = 'starting';
  broadcastStatus();

  log(`Starting server on port ${port}...`);

  const serverScript = path.join(serverDir, 'server.js');

  // Use system Node.js (not Electron's) so native modules (better-sqlite3) work
  // without needing to rebuild against Electron's Node ABI
  const nodeBin = process.platform === 'win32' ? 'node.exe' : 'node';
  serverProcess = spawn(nodeBin, [serverScript], {
    cwd: serverDir,
    env: {
      ...process.env,
      DB_PATH: dbPath,
      PORT: String(port),
      NODE_ENV: 'production'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false
  });

  serverProcess.stdout.on('data', (data) => log(`[server] ${data}`));
  serverProcess.stderr.on('data', (data) => log(`[server:err] ${data}`));

  serverProcess.on('exit', (code) => {
    log(`Server exited with code ${code}`);
    if (currentState === 'running') {
      currentState = 'error';
      broadcastStatus('Server process exited unexpectedly');
      updateTray();
    }
  });

  pollHealth(port, 30, 500);
}

function stopServer() {
  return new Promise((resolve) => {
    if (!serverProcess) return resolve();

    const pid = serverProcess.pid;
    serverProcess.removeAllListeners('exit');

    serverProcess.once('exit', () => {
      serverProcess = null;
      resolve();
    });

    serverProcess.kill('SIGTERM');

    // Force kill after 3 seconds
    setTimeout(() => {
      try {
        if (serverProcess) {
          serverProcess.kill('SIGKILL');
        }
      } catch (_) {
        // already dead
      }
      serverProcess = null;
      resolve();
    }, 3000);
  });
}

async function restartServer() {
  log('Restarting server...');
  await stopServer();
  startServer();
}

function pollHealth(port, retries, interval) {
  if (retries <= 0) {
    currentState = 'error';
    broadcastStatus('Server failed to start within timeout');
    updateTray();
    return;
  }

  const req = http.get(`http://localhost:${port}/api/brands`, (res) => {
    if (res.statusCode === 200) {
      currentState = 'running';
      broadcastStatus();
      updateTray();
      log('Server healthy');

      // Check for updates silently after server is up
      checkForUpdates();
    } else {
      retryPoll(port, retries, interval);
    }
  });

  req.on('error', () => retryPoll(port, retries, interval));
  req.setTimeout(2000, () => {
    req.destroy();
    retryPoll(port, retries, interval);
  });
}

function retryPoll(port, retries, interval) {
  setTimeout(() => pollHealth(port, retries - 1, interval), interval);
}

// --- IPC ---

function broadcastStatus(error) {
  const payload = {
    state: currentState,
    port: getPort(),
    ...(error && { error })
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server:status', payload);
  }
}

ipcMain.on('server:restart', () => restartServer());

ipcMain.on('app:open-browser', () => {
  shell.openExternal(`http://localhost:${getPort()}`);
});

ipcMain.on('settings:get', (event) => {
  event.reply('settings:get:reply', loadSettings());
});

ipcMain.on('settings:save', (_event, settings) => {
  saveSettings(settings);
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  log(`Settings saved: port=${settings.port}, launchAtLogin=${settings.launchAtLogin}`);
});

ipcMain.on('logs:open', () => {
  shell.openPath(logPath);
});

// --- Windows ---

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 420,
    height: 280,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    center: true,
    backgroundColor: '#0d0d0d',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.setMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Send current state once renderer is ready
  mainWindow.webContents.on('did-finish-load', () => {
    broadcastStatus();
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 380,
    height: 240,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    center: true,
    backgroundColor: '#0d0d0d',
    parent: mainWindow || undefined,
    modal: false,
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'src', 'settings.html'));
  settingsWindow.setMenu(null);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

ipcMain.on('settings:open', () => createSettingsWindow());

function getAppIcon() {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = path.join(__dirname, 'assets', iconFile);
  if (fs.existsSync(iconPath)) return iconPath;
  return undefined;
}

// --- Tray ---

function createTray() {
  const trayIconPath = path.join(__dirname, 'assets', 'tray-idle.png');
  let trayIcon;
  if (fs.existsSync(trayIconPath)) {
    trayIcon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 });
  } else {
    // Fallback: create a simple 16x16 icon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('KayFlux — Starting');
  updateTrayMenu();

  tray.on('click', () => createMainWindow());
}

function updateTray() {
  if (!tray) return;

  const isError = currentState === 'error';
  const iconFile = isError ? 'tray-error.png' : 'tray-idle.png';
  const iconPath = path.join(__dirname, 'assets', iconFile);

  if (fs.existsSync(iconPath)) {
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray.setImage(icon);
  }

  tray.setToolTip(isError ? 'KayFlux — Error' : 'KayFlux — Running');
  updateTrayMenu();
}

function updateTrayMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open KayFlux',
      click: () => shell.openExternal(`http://localhost:${getPort()}`)
    },
    {
      label: 'Restart Server',
      click: () => restartServer()
    },
    { type: 'separator' },
    {
      label: 'Settings...',
      click: () => createSettingsWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit KayFlux',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}

// --- Auto-update ---

function checkForUpdates() {
  if (!app.isPackaged) return;
  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.checkForUpdates();
  } catch (e) {
    log(`Auto-update check failed: ${e.message}`);
  }
}

autoUpdater.on('update-available', () => {
  log('Update available — downloading in background');
});

autoUpdater.on('update-downloaded', () => {
  log('Update downloaded — will install on next quit');
  if (tray) {
    updateTrayMenu();
  }
});

autoUpdater.on('error', (err) => {
  log(`Auto-update error: ${err.message}`);
});

// --- App lifecycle ---

app.on('ready', () => {
  createTray();
  createMainWindow();
  startServer();
});

app.on('second-instance', () => {
  createMainWindow();
});

app.on('window-all-closed', () => {
  // Don't quit — tray keeps running
});

app.on('before-quit', async () => {
  await stopServer();
});

app.on('activate', () => {
  createMainWindow();
});
