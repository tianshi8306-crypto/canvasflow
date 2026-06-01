import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/app-boot.css";
import "./styles/global.css";
import "@/components/nodes/nodeChrome/nodeChromeTokens.css";
import "@xyflow/react/dist/style.css";
import { AppRoot } from "@/app/AppRoot";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
