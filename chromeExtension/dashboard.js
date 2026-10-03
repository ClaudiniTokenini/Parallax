const env = typeof PARALLAX_ENV === "object" && PARALLAX_ENV ? PARALLAX_ENV : {};
const DASHBOARDS = [
  env.dashboardUrl,
  "http://127.0.0.1:3000",
  "http://localhost:3000"
].filter(Boolean);

(async () => {
  for (const base of [...new Set(DASHBOARDS)]) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) {
        window.location.replace(base);
        return;
      }
    } catch {
      // try next
    }
  }
})();
