import { BrowserWindow, Screen, Tray, Utils } from "electrobun/bun";
import type { MenuItemConfig } from "electrobun/bun";
import { join } from "node:path";

export class WindowManager {
  private win: BrowserWindow | null = null;
  private _tray: Tray | null = null;
  private appAssets: string;

  constructor(appAssets: string) {
    this.appAssets = appAssets;
  }

  get window(): BrowserWindow | null {
    return this.win;
  }

  get tray(): Tray | null {
    return this._tray;
  }

  private getTrayMenu(isShown: boolean): MenuItemConfig[] {
    return [
      {
        type: "normal",
        label: "Show",
        action: "show",
        hidden: isShown,
      },
      {
        type: "normal",
        label: "Hide",
        action: "hide",
        hidden: !isShown,
      },
      {
        type: "separator",
      },
      {
        type: "normal",
        label: "Quit",
        action: "quit",
      },
    ];
  }

  openAppUI(rpc: any, onDomReady?: () => void, isFirstLoad?: boolean) {
    if (this.win) {
      this.win.show();
      return;
    }

    const { width, height } = Screen.getPrimaryDisplay().workArea;
    this.win = new BrowserWindow({
      title: "Kuumo app",
      url: "views://src/index.html",
      frame: { x: 0, y: 0, width, height },
      rpc,
      titleBarStyle: "hidden",
    });

    this.win?.webview?.on("domReady", () => {
      this.win?.maximize();
      if (isFirstLoad && onDomReady) {
        onDomReady();
      }
    });

    this.win?.on("close", () => {
      this.win = null;
    });
  }

  close(QuitonClose: boolean) {
    if (QuitonClose) {
      this.win?.close();
      Utils.quit();
    } else {
      this.win?.close();
      this._tray?.setMenu(this.getTrayMenu(false));
    }
  }

  minimize() {
    this.win?.minimize();
  }

  openDevTools() {
    this.win?.webview.openDevTools();
  }

  createTray(onAction: (action: string) => void) {
    this._tray = new Tray({
      title: "Music app",
      image: join(this.appAssets, "assets", "trayicon.ico"),
      template: true,
    });

    this._tray?.setMenu(this.getTrayMenu(true));
    this._tray?.on("tray-clicked", (e: { data: { action: string } }) => {
      const action = e?.data?.action ?? "nothing";
      onAction(action);
    });
  }

  setTrayMenu(isShown: boolean) {
    this._tray?.setMenu(this.getTrayMenu(isShown));
  }
}
