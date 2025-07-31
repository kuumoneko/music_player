import pkg from 'electron'
const { BrowserWindow } = pkg

export function createAuthWindow(url: string, port: number) {
    return new Promise((resolve, reject) => {
        let authWindow = new BrowserWindow({
            width: 600,
            height: 800,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            }
        });

        authWindow.loadURL(url);
        authWindow.show();
        authWindow.focus();

        authWindow.webContents.on('did-navigate', (event, newUrl) => {
            if (newUrl.startsWith(`http://localhost:${port}`)) {
                event.preventDefault(); // Stop the navigation

                const parsedUrl = new URL(newUrl);
                const code = parsedUrl.searchParams.get('code');
                const error = parsedUrl.searchParams.get('error');

                if (code) {
                    authWindow.close();
                    return resolve(code as string)
                } else if (error) {
                    authWindow.close();
                    return reject(error as string)
                }
                else {
                    authWindow.close();
                    return reject("")
                }
            }

        });

        authWindow.webContents.on('did-fail-load', (event: any, oldUrl: any, newUrl: any, isMainFrame: any) => {
            const url = isMainFrame;

            if (url.startsWith(`http://localhost:${port}`)) {
                event.preventDefault(); // Stop the navigation

                const parsedUrl = new URL(url);
                const code = parsedUrl.searchParams.get('code');
                const error = parsedUrl.searchParams.get('error');

                if (code) {
                    authWindow.close();
                    return resolve(code as string)
                } else if (error) {
                    authWindow.close();
                    return reject(error as string)
                }
                else {
                    authWindow.close();
                    return reject("")
                }
            }
        })
    })
}