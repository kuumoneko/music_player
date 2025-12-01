# Music player web app

> A Music web app built on React.js and Nodejs

## UPDATE NOTE

- Server

> Fix: Spotify token expires after 1 hour

- Client

> Feature: Get data from server with dynamic time

## ABOUT

> This is a web that you can find, play and download songs from Youtube and Spotify
>
> Version: 3.7.0
>
> Please give error on issue tab, i will check per week

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

- run `npm install`

### Test app

- You can set your app mode in .env
- If mode is react, you can run with `npm run dev`

```env
MODE=test
```

### Build app

```shell
node build_example.ts
```

## Learn More

- About React [React](https://reactjs.org/).

- About Taiwindcss [Tailwindcss](https://tailwindcss.com/).

- About Vite [Vite](https://vite.dev/).

## Contributor

- [kuumoneko](https://github.com/kuumoneko)
