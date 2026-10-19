import {registerPwa} from "./pwa";
import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./fonts.css";
import "./mobile-forms.css";
import "@fontsource/lalezar/arabic-400.css";
import Entry from "./Entry";
import Observability from "./components/Observability";
import AppUpdate from "./components/AppUpdate";
import ScreenBoundary from "./components/ScreenBoundary";
import { startUpdates } from "./updates";
import { canonicalPath } from "./routing";

const root = document.getElementById("root");
const app = <BrowserRouter><ScreenBoundary><Entry /></ScreenBoundary><AppUpdate /><Observability /></BrowserRouter>;
if (root.dataset.prerendered === canonicalPath(location.href).split(/[?#]/)[0]) hydrateRoot(root, app);
else createRoot(root).render(app);

registerPwa();
startUpdates();
