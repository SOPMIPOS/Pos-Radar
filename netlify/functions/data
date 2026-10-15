// Pantau Cawangan — satu salinan data dikongsi untuk semua pengguna.
// GET  /api/data            → data terakhir (tidak menarik dari sumber)
// GET  /api/data?since=<t>  → {unchanged:true} jika tiada data baharu sejak t
// POST /api/data            → tarik data baharu, HANYA jika sudah 30 minit sejak tarikan terakhir
import { getStore } from "@netlify/blobs";

const MIN_GAP = 30 * 60e3;   // had kemas kini: sekali setiap 30 minit untuk semua pengguna
const LOCK_MS = 2 * 60e3;    // elak dua tarikan serentak
const HOUR = 3600e3, DAY = 24 * HOUR;

function mytStamp(t) {
  const d = new Date(t + 8 * HOUR), p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00`;
}
const SRC = {
  met: () => `https://api.data.gov.my/weather/warning?limit=500&timestamp_start=${encodeURIComponent(mytStamp(Date.now() - 7 * DAY) + "@warning_issue__issued")}`,
  ipu: () => "https://eqms.doe.gov.my/api3/publicmapproxy/PUBLIC_DISPLAY/CAQM_MCAQM_Current_Reading/MapServer/0/query?where=1%3D1&outFields=STATION_ID%2CSTATION_LOCATION%2CPLACE%2CSTATE_NAME%2CAPI%2CCLASS%2CDATETIME%2CLATITUDE%2CLONGITUDE&returnGeometry=false&f=json",
  jps: () => "https://publicinfobanjir.water.gov.my/cerapan/amaran-semasa/",
};

async function pull(url, kind) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (PantauCawanganPos)", Accept: "*/*" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return kind === "json" ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}

// Kecilkan data sebelum disimpan & dihantar ke pelayar
const slimMet = (d) => (Array.isArray(d) ? d : (d && d.data) || []).map((w) => ({
  warning_issue: { issued: w.warning_issue?.issued, title_bm: w.warning_issue?.title_bm, title_en: w.warning_issue?.title_en },
  valid_from: w.valid_from, valid_to: w.valid_to, heading_bm: w.heading_bm, heading_en: w.heading_en,
  text_bm: w.text_bm, text_en: w.text_bm ? undefined : w.text_en,
}));
const slimIpu = (d) => ({ features: ((d && d.features) || []).map((f) => ({ attributes: f.attributes || {} })) });
const slimJps = (html) => String(html)
  .replace(/<head[\s\S]*?<\/head>/i, "")
  .replace(/<(script|style|svg|noscript|nav|footer)[\s\S]*?<\/\1>/gi, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\s{2,}/g, " ")
  .slice(0, 600000);

const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const nextAt = (meta) => (meta && meta.fetchedAt ? meta.fetchedAt + MIN_GAP : 0);

export default async (req) => {
  const store = getStore({ name: "pantau-cawangan", consistency: "strong" });
  const url = new URL(req.url);

  if (req.method === "GET") {
    const meta = (await store.get("meta", { type: "json" })) || {};
    const since = Number(url.searchParams.get("since")) || 0;
    const base = { nextAllowedAt: nextAt(meta), busy: (meta.lockUntil || 0) > Date.now(), serverNow: Date.now() };
    if (since && meta.fetchedAt === since) return json({ unchanged: true, fetchedAt: meta.fetchedAt, ...base });
    const snap = await store.get("snapshot", { type: "json" });
    return json({ ...(snap || { empty: true }), ...base });
  }

  if (req.method !== "POST") return json({ error: "Kaedah tidak dibenarkan" }, 405);

  const now = Date.now();
  const entry = await store.getWithMetadata("meta", { type: "json" });
  const meta = (entry && entry.data) || {};

  // Had 30 minit: tolak, tetapi hantar data sedia ada
  if (meta.fetchedAt && now - meta.fetchedAt < MIN_GAP) {
    const snap = await store.get("snapshot", { type: "json" });
    return json({ ...(snap || { empty: true }), refused: true, nextAllowedAt: nextAt(meta), serverNow: now }, 429);
  }
  if ((meta.lockUntil || 0) > now) return json({ busy: true, nextAllowedAt: nextAt(meta), serverNow: now }, 409);

  // Kunci — hanya seorang boleh menarik pada satu masa
  const lock = { ...meta, lockUntil: now + LOCK_MS };
  const w = entry
    ? await store.setJSON("meta", lock, { onlyIfMatch: entry.etag })
    : await store.setJSON("meta", lock, { onlyIfNew: true });
  if (w && w.modified === false) return json({ busy: true, nextAllowedAt: nextAt(meta), serverNow: now }, 409);

  const prev = (await store.get("snapshot", { type: "json" })) || {};
  const [m, i, j] = await Promise.allSettled([pull(SRC.met(), "json"), pull(SRC.ipu(), "json"), pull(SRC.jps(), "html")]);
  const res = { met: [m, slimMet], ipu: [i, slimIpu], jps: [j, slimJps] };
  const sources = {};
  let anyOk = false;
  for (const [k, [r, slim]] of Object.entries(res)) {
    if (r.status === "fulfilled") { sources[k] = { ok: true, data: slim(r.value), fetchedAt: now }; anyOk = true; }
    else {
      const old = prev.sources && prev.sources[k];
      const err = String((r.reason && r.reason.message) || r.reason || "gagal");
      sources[k] = old && old.data != null ? { ...old, ok: false, stale: true, err } : { ok: false, err };
    }
  }

  // Sejarah IPU > 100 untuk 8 hari (supaya paparan 7 hari sama untuk semua pengguna)
  const cut = now - 8 * DAY, seen = new Set();
  const cur = sources.ipu.ok ? sources.ipu.data.features.map((f) => f.attributes).filter((a) => +a.API > 100) : [];
  const ipuHist = (prev.ipuHist || []).concat(cur)
    .filter((a) => +a.DATETIME > cut)
    .filter((a) => { const k = a.STATION_ID + "|" + a.DATETIME; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(-4000);

  const fetchedAt = anyOk ? now : prev.fetchedAt || null;
  const snap = { fetchedAt, sources, ipuHist };
  await store.setJSON("snapshot", snap);
  await store.setJSON("meta", { fetchedAt: anyOk ? now : meta.fetchedAt || null, lockUntil: 0, lastAttempt: now });
  return json({ ...snap, nextAllowedAt: anyOk ? now + MIN_GAP : 0, serverNow: now }, anyOk ? 200 : 502);
};

export const config = { path: "/api/data" };
