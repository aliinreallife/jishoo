import {registerPwa} from "./pwa";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./fonts.css";
import "@fontsource/lalezar/arabic-400.css";
import Entry from "./Entry";
import Observability from "./components/Observability";

createRoot(document.getElementById("root")).render(<BrowserRouter><Entry /><Observability /></BrowserRouter>);

registerPwa();
