// Reemplaza tu función por esta
function buildWsUrlBase(): string {
  const envUrl = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  if (envUrl) {
    const u = new URL(envUrl);
    u.pathname = "/ws";
    if (!u.searchParams.has("room")) u.searchParams.set("room", ROOM);
    if (!u.searchParams.has("role")) u.searchParams.set("role", "canvas");
    return u.toString();
  }
  const { protocol, host } = window.location;
  const scheme = protocol === "https:" ? "wss" : "ws";
  const u = new URL(`${scheme}://${host}/ws`);
  u.searchParams.set("room", ROOM);
  u.searchParams.set("role", "canvas");
  return u.toString();
}
