import {registerPwa} from "./pwa";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./fonts.css";
import "./mobile-forms.css";
import "@fontsource/lalezar/arabic-400.css";
import Entry from "./Entry";
import Observability from "./components/Observability";
import AppUpdate from "./components/AppUpdate";
import { startUpdates } from "./updates";

createRoot(document.getElementById("root")).render(<BrowserRouter><Entry /><AppUpdate /><Observability /></BrowserRouter>);

registerPwa();
startUpdates();
