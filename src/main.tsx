import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/global.css";
import "@xyflow/react/dist/style.css";
import { AppRoot } from "@/app/AppRoot";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
