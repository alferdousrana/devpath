// ---------------------------------------------------------------------------
// Code execution: architecture placeholder.
//
// GitHub Pages + Firebase can't safely run arbitrary user code, so this app
// does NOT pretend to. Every challenge already carries machine-readable test
// cases (data/coding.json → tests[]); a future runner just has to implement:
//
//   async run({ language, code, tests }) → {
//     supported: true,
//     results: [{ name, passed, expected, actual, stdout, error, ms }]
//   }
//
// Two realistic ways to plug one in later:
//  1. In-browser Python via Pyodide (WebAssembly). Works on static hosting;
//     ~10 MB download; SQL challenges can use sql.js the same way.
//  2. A sandboxed execution API (e.g. a self-hosted Judge0, or a Cloud Run
//     service called from a Firebase Cloud Function that verifies the user's
//     ID token). Needed for Django/Docker style backend challenges.
// Register an implementation with setRunner() at startup.
// ---------------------------------------------------------------------------
let impl = null;

export function setRunner(runner) { impl = runner; }
export const runnerAvailable = (language) => Boolean(impl?.supports?.(language));

export async function run({ language, code, tests }) {
  if (!impl || !impl.supports(language)) {
    return { supported: false, reason: "No execution backend is connected. Check your solution against the test cases by hand, or run it locally." };
  }
  return impl.run({ language, code, tests });
}
