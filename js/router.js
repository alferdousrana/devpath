// Hash-based router: works on GitHub Pages (including /repo-name/ subpaths)
// with no server-side rewrite rules.
const routes = [];
let notFound = null;
let onChangeCb = null;
let lastPath = null;

export function route(pattern, view, opts = {}) {
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/\//g, "\\/").replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "$");
  routes.push({ pattern, re, keys, view, ...opts });
}
export const fallback = (view) => { notFound = view; };
export const onRoute = (cb) => { onChangeCb = cb; };

export function parse(hash = location.hash) {
  const raw = hash.replace(/^#/, "") || "/";
  const [path, qs = ""] = raw.split("?");
  return { path: path || "/", query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function navigate(path, { replace = false } = {}) {
  const h = "#" + path;
  if (replace) history.replaceState(null, "", h); else if (location.hash !== h) location.hash = h;
  if (replace || location.hash === h) resolve();
}

export function resolve() {
  const { path, query } = parse();
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const same = lastPath === path;
      lastPath = path;
      onChangeCb?.({ route: r, params, query, path, same });
      return;
    }
  }
  onChangeCb?.({ route: { view: notFound, pattern: "*" }, params: {}, query, path });
}

window.addEventListener("hashchange", resolve);
