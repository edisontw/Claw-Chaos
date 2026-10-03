import "./style.css";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root element.");

const bootstrapStartedAtMs = performance.now();

root.innerHTML = `
  <div class="loading-shell" role="status" aria-live="polite">
    <strong>CLAW CHAOS</strong>
    <span>Loading machine…</span>
  </div>
`;
root.dataset.bootstrap = "parallel";

const physicsPromise = import("./physics/PhysicsRuntime").then(
  ({ PhysicsRuntime }) => PhysicsRuntime.create(),
);
const appPromise = import("./app/startApp");

appPromise
  .then(({ startApp }) =>
    startApp(root, physicsPromise, bootstrapStartedAtMs),
  )
  .catch((error: unknown) => {
    console.error("Failed to start Claw Chaos.", error);
    root.innerHTML = `<main class="fatal-error"><h1>Claw Chaos failed to start</h1><p>Open the browser console for diagnostic details.</p></main>`;
  });
