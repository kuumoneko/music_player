# Music player web app

> A Music web app built on React.js and Nodejs

## UPDATE NOTE

> Use Vite to create react app
>
> Update to taiwindcss 4
>
> Use ffmpeg binary to handle local audio file

- Server

> remove download, add music
>
> update binary ffmpeg
>
> add controllers and route to hanlder api requests
>
> Update lib and utils

- Client

> Remove Sidebar
>
> Remove Youtube and Spotify login account
>
> Update UI

## ABOUT

> This is a web that you can find, play and download songs from Youtube and Spotify
>
> Version: 3.6.0
>
> Please give error on issue tab, i will check per week

## Dev

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

- set test_id for youtube test quota
- run `npm install`

### Test app

- You can set your app mode in .env
- If mode is react, you can run with `npm run dev`

```ts
enum Mode {
    react = "testreact",
    app = "testapp",
    deploy = "deploy",
}
const mode: Mode = Mode.react;
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
