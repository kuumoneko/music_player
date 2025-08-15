# Music player web app

> A Music web app built on React.js and Nodejs

## ABOUT

> This is a web that you can find, play and download songs from Youtube and Spotify
> Version: 2.0.0

## UPDATE NOTE

> Fix deno to build app lighter

## Usage

### Credential

#### Youtube

- Go to [Google developer cloud console](https://console.cloud.google.com)
- Create a project
- Enable [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
- In Credential tab, create a new API key for Youtube Data API V3 and paste API key to Youtube API key in system.json
- In Credential tab, create a new OAuth client ID for login with youtube account then download client json and paste to system.json in key `web`
- NOTE: If API is in the same project with OAuth client, set it `isAuth` is true
- NOTE: You should to have at least 2 api keys, once for OAuth and the another for normal data

```json
{
  "api_key": "Your API key",
  "reach_quota": false,
  "isAuth": true if API in the same project with OAuth Client ID,
  "date_reached": "",
  "time_reached": ""
}
```

#### Spotify

- Go to [Spotify for Developers](https://developer.spotify.com/)
- Login to Spotify, the create a project
- Get ClientID and Client secret and paste to system.json

```json
{
  "Spotify_Api_key": "Your Client secret",
  "Spotify_client": "Your client ID"
}
```

### Setup

- set test_id for youtube test quota
- run `npm install`

### Test app

- You can set your app mode in server/index.ts
- If mode is react, you can run with `react-script start`

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

## Contributor

- [kuumoneko](https://github.com/kuumoneko)
