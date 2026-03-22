import { BrowserWindow } from "electrobun";
import { getDataFromDatabase } from "./lib/database.js";

export default async function LoginWithGoogle(appPath: string): Promise<{
    access_token: string,
    expires_in: number,
    refresh_token_expires_in: number,
    refresh_token: string, token_type: string
}> {
    const { personal } = await getDataFromDatabase(appPath, "data", "system");
    const { client_id, scopes, redirect_uris } = personal ?? {};
    const REDIRECT_URI = (redirect_uris[0] ?? "http://localhost") + "/callback";
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', client_id);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');

    return new Promise((resolve, reject) => {
        const win = new BrowserWindow({
            title: "Login with Google",
            titleBarStyle: "hidden",
            url: authUrl.toString()
        });
        win.webview.on("will-navigate", async (event: any) => {
            const newUrl: string = event.url;
            if (newUrl.startsWith(REDIRECT_URI)) {
                event.preventDefault();
                const urlObj = new URL(newUrl);
                const code = urlObj.searchParams.get('code');
                const error = urlObj.searchParams.get('error');

                if (error) {
                    win.close();
                    return reject(new Error(`Google OAuth Error: ${error}`));
                }

                if (code) {

                    try {
                        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                            body: new URLSearchParams({
                                code: code,
                                client_id: client_id,
                                client_secret: this.data.client_secret,
                                redirect_uri: REDIRECT_URI,
                                grant_type: 'authorization_code'
                            })
                        });

                        const tokenData: {
                            access_token: string,
                            expires_in: number,
                            refresh_token_expires_in: number,
                            refresh_token: string,
                            error: any, error_description: any, token_type: string
                        } = await tokenResponse.json();

                        if (tokenData.error) {
                            reject(new Error(`Token exchange failed: ${tokenData.error_description}`));
                        } else {
                            resolve(tokenData);
                        }
                        win.close();
                    } catch (exchangeError) {
                        reject(exchangeError);
                    }
                }
            }
        })
    })
}

