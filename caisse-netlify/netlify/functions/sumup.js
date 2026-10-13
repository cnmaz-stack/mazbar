// Fonction Netlify : relais sécurisé entre la caisse et l'API Cloud de SumUp (terminal Solo).
// Les clés restent ici, côté serveur : elles ne sont jamais envoyées au navigateur.
const crypto = require("node:crypto");

const API = "https://api.sumup.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let readerCache = null;

const env = (k) => (process.env[k] || "").trim();

function reply(status, body) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

function fail(status, code, error) {
  const e = new Error(error);
  e.status = status;
  e.code = code;
  return e;
}

function authorized(event) {
  const expected = env("CAISSE_TOKEN");
  if (!expected) return false; // sans code d'accès configuré, on refuse tout
  const got = String((event.headers && (event.headers["x-caisse-token"] || event.headers["X-Caisse-Token"])) || "");
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function need(...names) {
  for (const n of names) {
    if (!env(n)) throw fail(500, "config", `Configuration serveur incomplète : la variable ${n} est manquante.`);
  }
}

async function sumup(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: "Bearer " + env("SUMUP_API_KEY"), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { /* réponse non JSON */ }
  if (!res.ok) {
    const type = (data && data.type) || "";
    const detail = (data && (data.detail || data.title)) || `Erreur SumUp ${res.status}`;
    if (res.status === 401 || res.status === 403) throw fail(502, "sumup_auth", "SumUp a refusé la clé API (clé invalide ou droits insuffisants).");
    if (res.status === 404) throw fail(404, "not_found", "Ressource introuvable chez SumUp (vérifiez le code marchand et l'appairage du Solo).");
    if (res.status === 422 && /offline/i.test(type + " " + detail)) throw fail(409, "reader_offline", "Le Solo est hors ligne : vérifiez qu'il est allumé, branché et connecté (Wi-Fi ou 4G).");
    if (res.status === 409) throw fail(409, "conflict", "Le Solo est occupé par un autre paiement. Patientez une minute puis réessayez.");
    throw fail(502, "sumup_error", `SumUp a refusé la demande : ${detail}`);
  }
  return data;
}

const merchant = () => encodeURIComponent(env("SUMUP_MERCHANT_CODE"));

async function readerId() {
  if (env("SUMUP_READER_ID")) return env("SUMUP_READER_ID");
  if (readerCache) return readerCache;
  const list = await sumup("GET", `/v0.1/merchants/${merchant()}/readers`);
  const r = ((list && list.items) || []).find(
    (x) => x.status === "paired" && x.device && (x.device.model === "solo" || x.device.model === "virtual-solo")
  );
  if (!r) throw fail(404, "no_reader", "Aucun Solo appairé à ce compte SumUp. Appairez-le depuis les Réglages de la caisse.");
  readerCache = r.id;
  return r.id;
}

const actions = {
  async checkout(input) {
    need("SUMUP_MERCHANT_CODE", "SUMUP_API_KEY", "SUMUP_AFFILIATE_KEY", "SUMUP_APP_ID");
    const max = parseInt(env("MAX_AMOUNT_CENTS"), 10) || 100000;
    const amount = input.amount;
    if (!Number.isInteger(amount) || amount < 1 || amount > max) {
      throw fail(400, "bad_amount", "Montant invalide.");
    }
    const description = String(input.description || "Commande").slice(0, 100);
    const reference = crypto.randomUUID();
    const rid = await readerId();
    const out = await sumup("POST", `/v0.1/merchants/${merchant()}/readers/${encodeURIComponent(rid)}/checkout`, {
      total_amount: { currency: "EUR", minor_unit: 2, value: amount },
      description,
      affiliate: { app_id: env("SUMUP_APP_ID"), key: env("SUMUP_AFFILIATE_KEY"), foreign_transaction_id: reference },
    });
    const d = (out && out.data) || {};
    if (!d.checkout_id) throw fail(502, "sumup_error", "Réponse inattendue de SumUp.");
    return { checkout_id: d.checkout_id, client_transaction_id: d.client_transaction_id || "", reference };
  },

  async status(input) {
    need("SUMUP_MERCHANT_CODE", "SUMUP_API_KEY");
    if (!UUID.test(String(input.checkout_id || ""))) throw fail(400, "bad_id", "Identifiant de paiement invalide.");
    const rid = await readerId();
    const out = await sumup("GET", `/v0.1/merchants/${merchant()}/readers/${encodeURIComponent(rid)}/checkout/${input.checkout_id}`);
    const d = (out && out.data) || {};
    return {
      status: d.status || "pending",
      payment_status: d.payment_status || null,
      failure_reason: d.payment_failure_reason || null,
      client_transaction_id: d.client_transaction_id || null,
    };
  },

  async cancel() {
    need("SUMUP_MERCHANT_CODE", "SUMUP_API_KEY");
    const rid = await readerId();
    await sumup("POST", `/v0.1/merchants/${merchant()}/readers/${encodeURIComponent(rid)}/terminate`);
    return { ok: true };
  },

  async reader() {
    need("SUMUP_MERCHANT_CODE", "SUMUP_API_KEY");
    const rid = await readerId();
    const info = await sumup("GET", `/v0.1/merchants/${merchant()}/readers/${encodeURIComponent(rid)}`);
    let st = {};
    try {
      const s = await sumup("GET", `/v0.1/merchants/${merchant()}/readers/${encodeURIComponent(rid)}/status`);
      st = (s && s.data) || {};
    } catch (_) { /* le statut détaillé demande un firmware récent : on continue sans */ }
    return {
      name: info && info.name,
      paired: !!info && info.status === "paired",
      online: st.status ? st.status === "ONLINE" : null,
      state: st.state || null,
      battery: typeof st.battery_level === "number" ? Math.round(st.battery_level) : null,
      connection: st.connection_type || null,
    };
  },

  async pair(input) {
    need("SUMUP_MERCHANT_CODE", "SUMUP_API_KEY");
    const code = String(input.pairing_code || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{8,9}$/.test(code)) throw fail(400, "bad_code", "Le code d'appairage compte 8 ou 9 caractères (lettres et chiffres).");
    const name = String(input.name || "Caisse").slice(0, 60);
    const out = await sumup("POST", `/v0.1/merchants/${merchant()}/readers`, { pairing_code: code, name });
    readerCache = null;
    return { id: out && out.id, status: out && out.status, name: out && out.name };
  },
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "Méthode non autorisée", code: "method" });
  if (!authorized(event)) {
    return reply(401, { error: "Code d'accès de la caisse incorrect ou non configuré.", code: "bad_token" });
  }
  let input;
  try { input = JSON.parse(event.body || "{}"); } catch (_) { return reply(400, { error: "Requête illisible.", code: "bad_json" }); }
  const fn = actions[input.action];
  if (!fn) return reply(400, { error: "Action inconnue.", code: "bad_action" });
  try {
    return reply(200, await fn(input));
  } catch (e) {
    const status = e.status || 500;
    if (!e.code) console.error("sumup function error:", e);
    return reply(status, { error: e.code ? e.message : "Erreur interne.", code: e.code || "internal" });
  }
};
