import React from "react";
import ReactDOM from "react-dom/client";
import { applyAppTheme } from "@/lib/appTheme";
import "./styles/app-boot.css";
import "./styles/global.css";
import "./styles/app-theme.css";
import "./styles/app-theme-nodes.css";
import "@/components/nodes/nodeChrome/nodeChromeTokens.css";

applyAppTheme("dark");
import "@xyflow/react/dist/style.css";
import { AppRoot } from "@/app/AppRoot";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
