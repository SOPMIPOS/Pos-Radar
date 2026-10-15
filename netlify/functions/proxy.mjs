// Proxy kecil untuk butang "Kemas kini data".
// Pelayar tidak boleh membaca sesetengah laman kerajaan terus (sekatan CORS),
// jadi fungsi ini mengambil data bagi pihak halaman. Hanya domain rasmi di bawah dibenarkan.
const ALLOW = new Set([
  "api.data.gov.my",
  "eqms.doe.gov.my",
  "publicinfobanjir.water.gov.my",
]);

export default async (req) => {
  const target = new URL(req.url).searchParams.get("u");
  let url;
  try { url = new URL(target); } catch { return json({ error: "URL tidak sah" }, 400); }
  if (url.protocol !== "https:" || !ALLOW.has(url.hostname)) {
    return json({ error: "Domain tidak dibenarkan" }, 403);
  }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(url, {
      signal: ctl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (PantauCawanganPos)", "Accept": "*/*" },
    });
    clearTimeout(t);
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "text/plain; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=60",
      },
    });
  } catch (e) {
    return json({ error: "Sumber tidak dapat dihubungi", detail: String(e) }, 502);
  }
};

function json(o, status) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

export const config = { path: "/api/proxy" };
