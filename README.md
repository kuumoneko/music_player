# Online Judge

> Front-end: React.js
>
> Back-end: Node.js

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm run data_server`

Runs the backend server.\
It will run at [http://localhost:3001](http://localhost:3001) by defaults.

The server will reload if you make edits.\
You will also see any lint errors in the console.

### Change server mode

- Open `src/index.tsx`
- Change the server mode

```tsx
enum ServerMode {
    production = "production",
    test = "test",
}

// Server mode will be here
const mode = ServerMode.production; // or Servermode.test
```

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

## Contributor

- [kuumoneko](https://github.com/kuumoneko)
