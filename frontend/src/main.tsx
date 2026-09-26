import React from "react";
import ReactDOM from "react-dom/client";
import * as THREE from "three";
import App from "./App";

// Polyfill for three.js r163+ matrix compatibility with react-force-graph-3d
if (typeof (THREE.Matrix4.prototype as any).determinantAffine !== "function") {
  (THREE.Matrix4.prototype as any).determinantAffine = function () {
    return this.determinant();
  };
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
