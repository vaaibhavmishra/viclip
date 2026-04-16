import { is, optimizer } from '@electron-toolkit/utils';
import { app } from 'electron';

export function configureDevTools(): void {
  // Set up development tools and shortcuts for every window
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);

    if (is.dev) {
      // Register shortcuts for this window only
      window.webContents.on('before-input-event', (event, input) => {
        const isOpenShortcut =
          (input.control || input.meta) && input.shift && input.code === 'KeyD';
        const isCloseShortcut =
          (input.control || input.meta) && input.shift && input.code === 'KeyW';

        if (isOpenShortcut) {
          window.webContents.openDevTools({ mode: 'detach' });
          event.preventDefault();
        }
        if (isCloseShortcut) {
          window.webContents.closeDevTools();
          event.preventDefault();
        }
      });
    }
  });
}
