import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App";
import setup from "./rpc";

setup();
createRoot(document.getElementById("root")!).render(<App />);
