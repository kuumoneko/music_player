# Music player app

> A Music Electron app built on React.js and Nodejs

## ABOUT

> This is a web that you can find, play and download songs from Youtube and Spotify
>
> Version: 4.4.0
>
> Please give error on issue tab, i will check per week
>
> Now just support Windows platform
>
> Play from local file is not avaiable

### Credential

#### Youtube

- Go to [Google developer cloud console](https://console.cloud.google.com)
- Create a project
- Enable [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com)

```json
{
  "ApiKey": "Your API key",
  "isReached": false, // true
}
```

#### Spotify

- Go to [Spotify for Developers](https://developer.spotify.com/)
- Login to Spotify, the create a project
- Get ClientID and Client secret and paste to system.json

```json
{
    "ApiKey": "Your Client secret",
    "ClientId": "Your client ID",
    "isReached":false, // true
    "RetryAfter":0
}
```

### Setup

- Add public/favicon.ico
- Run `npm install`

### Test app

- Run `npm run dev`

### Build app

- Run `npm run build`

## Learn More

- About React [React](https://reactjs.org/).

- About Taiwindcss [Tailwindcss](https://tailwindcss.com/).

- About Vite [Vite](https://vite.dev/).

- About Electron [Electron](https://www.electronjs.org/).

## Contributor

- [kuumoneko](https://github.com/kuumoneko)
