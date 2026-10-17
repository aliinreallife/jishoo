import {registerPwa} from "./pwa";
import React from "react";
import { createRoot } from "react-dom/client";
import "./fonts.css";
import "@fontsource/lalezar/arabic-400.css";
import App from "./App";
import "./styles.css";
import "./v2.css";
import "./community.css";
import "./v3.css";

createRoot(document.getElementById("root")).render(<App />);

registerPwa();
