import "./style.css";
import { startApp } from "./app/startApp";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root element.");

startApp(root).catch((error: unknown) => {
  console.error("Failed to start Claw Chaos.", error);
  root.innerHTML = `<main class="fatal-error"><h1>Claw Chaos failed to start</h1><p>Open the browser console for diagnostic details.</p></main>`;
});
