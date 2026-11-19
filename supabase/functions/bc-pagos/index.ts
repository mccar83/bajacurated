// Baja Curated — 20% deposit payments with Stripe Checkout.
// Actions (POST JSON): {action:"checkout", booking_ref, lang, test?} | {action:"confirmar", session_id}
// Stripe webhook: POST ?evt=<test|live> with stripe-signature header.
// Settings live in bc_payment_config (server only): stripe_mode = off | test | live, deposit_pct,
// webhook_id_<mode>, webhook_secret_<mode> (created automatically the first time).
// Keys: BC_STRIPE_SECRET_KEY_TEST / BC_STRIPE_SECRET_KEY_LIVE — Baja Curated only, independent of other apps in this project.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const SITE = "https://bajacurated.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Mode = "test" | "live";
const keyFor = (mode: Mode) =>
  mode === "live" ? Deno.env.get("BC_STRIPE_SECRET_KEY_LIVE") || "" : Deno.env.get("BC_STRIPE_SECRET_KEY_TEST") || "";

async function cfg(key: string): Promise<string | null> {
  const { data } = await admin.from("bc_payment_config").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}
async function setCfg(key: string, value: string) {
  await admin.from("bc_payment_config").upsert({ key, value, updated_at: new Date().toISOString() });
}

function form(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => {
      if (typeof item === "object") out.push(...form(item as Record<string, unknown>, `${key}[${i}]`));
      else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
    });
    else if (typeof v === "object") out.push(...form(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

async function stripe(mode: Mode, method: string, path: string, body?: Record<string, unknown>) {
  const key = keyFor(mode);
  if (!key) throw new Error(`missing_key_${mode}`);
  if (mode === "test" && !key.startsWith("sk_test_") && !key.startsWith("rk_test_")) throw new Error("test_key_not_test");
  if (mode === "live" && !key.startsWith("sk_live_") && !key.startsWith("rk_live_")) throw new Error("live_key_not_live");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? form(body).join("&") : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`stripe_${res.status}: ${data?.error?.message || "error"}`);
  return data;
}

async function ensureWebhook(mode: Mode) {
  if (await cfg(`webhook_secret_${mode}`)) return;
  const endpoint = await stripe(mode, "POST", "webhook_endpoints", {
    url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/bc-pagos?evt=${mode}`,
    description: "Baja Curated — depósitos de reservas",
    enabled_events: ["checkout.session.completed", "checkout.session.async_payment_succeeded", "charge.refunded"],
    metadata: { app: "baja_curated" },
  });
  await setCfg(`webhook_id_${mode}`, endpoint.id);
  await setCfg(`webhook_secret_${mode}`, endpoint.secret);
}

async function verifySignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"];
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${payload}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].every((c, i) => c === hex[i]));
}

const cents = (usd: number) => Math.round(usd * 100);
const fmtDate = (d: string, lang: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

async function groupFor(bookingRef: string) {
  const { data: one } = await admin.from("bc_bookings").select("group_ref").eq("booking_ref", bookingRef).maybeSingle();
  if (!one) return null;
  const q = admin.from("bc_bookings").select("id, booking_ref, group_ref, tour_id, booking_date, client_email, total_price, status, deposit_status, stripe_session_id");
  const { data: rows } = one.group_ref ? await q.eq("group_ref", one.group_ref) : await q.eq("booking_ref", bookingRef);
  return rows || [];
}

async function markPaid(session: any, mode: Mode) {
  if (session?.metadata?.app !== "baja_curated" || session.payment_status !== "paid") return false;
  const group = String(session.metadata.group_ref || "");
  const ref = String(session.metadata.booking_ref || "");
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
  const upd = { deposit_status: "paid", deposit_paid_at: new Date().toISOString(), stripe_payment_intent: pi, stripe_session_id: session.id, payment_mode: mode };
  // Only rows not yet paid: the webhook and the return page both call this, and only the first one notifies.
  const q = admin.from("bc_bookings").update(upd).neq("deposit_status", "refunded").neq("deposit_status", "paid");
  const { data: changed, error } = group
    ? await q.eq("group_ref", group).select("booking_ref, booking_date, start_time, client_name, client_email, client_phone, num_guests, total_price, tour_id")
    : await q.eq("booking_ref", ref).select("booking_ref, booking_date, start_time, client_name, client_email, client_phone, num_guests, total_price, tour_id");
  if (error) throw error;
  if (changed && changed.length) await notifyOwner(changed, (session.amount_total || 0) / 100, mode);
  return true;
}

async function notifyOwner(rows: any[], deposit: number, mode: Mode) {
  try {
    const r = rows[0];
    const { data: tour } = await admin.from("bc_tours").select("name").eq("id", r.tour_id).maybeSingle();
    const total = rows.reduce((s, x) => s + Number(x.total_price || 0), 0);
    const test = mode === "test" ? "[PRUEBA] " : "";
    await fetch("https://formspree.io/f/mjgjbool", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: `${test}Depósito pagado US$${deposit.toLocaleString("en-US")} · ${tour?.name || "Tour"} · ${r.booking_date} · ${r.client_name}`,
        tipo: "Depósito pagado (Stripe)",
        reserva: r.booking_ref,
        tour: tour?.name || "",
        fecha: `${r.booking_date} ${String(r.start_time || "").slice(0, 5)}`,
        vehiculos: rows.length,
        personas: r.num_guests,
        cliente: r.client_name,
        email: r.client_email,
        telefono: r.client_phone,
        deposito_usd: deposit,
        total_usd: total,
        saldo_en_sitio_usd: Math.round((total - deposit) * 100) / 100,
        panel: "https://bajacurated.com/panel/",
      }),
    });
  } catch (e) {
    console.error("notifyOwner", e);
  }
}

async function handleWebhook(req: Request, mode: Mode) {
  const payload = await req.text();
  const secret = await cfg(`webhook_secret_${mode}`);
  const sig = req.headers.get("stripe-signature") || "";
  if (!secret || !(await verifySignature(payload, sig, secret))) return json({ error: "invalid_signature" }, 400);
  const event = JSON.parse(payload);
  const ins = await admin.from("bc_payment_events").insert({ event_id: event.id, event_type: event.type, mode });
  if (ins.error?.code === "23505") return json({ received: true, duplicate: true });
  try {
    const obj = event.data?.object;
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await markPaid(obj, mode);
    } else if (event.type === "charge.refunded" && obj?.payment_intent && obj.refunded) {
      await admin.from("bc_bookings").update({ deposit_status: "refunded" }).eq("stripe_payment_intent", obj.payment_intent);
    }
    await admin.from("bc_payment_events").update({ status: "done", processed_at: new Date().toISOString() }).eq("event_id", event.id);
    return json({ received: true });
  } catch (e) {
    await admin.from("bc_payment_events").update({ status: "failed", error_message: String(e).slice(0, 500) }).eq("event_id", event.id);
    return json({ error: "processing_failed" }, 500);
  }
}

async function createCheckout(body: any) {
  const setting = (await cfg("stripe_mode")) || "off";
  const mode: Mode | null = setting === "live" ? "live" : setting === "test" && body.test ? "test" : null;
  if (!mode) return json({ enabled: false });
  const lang = body.lang === "es" ? "es" : "en";
  const rows = await groupFor(String(body.booking_ref || ""));
  if (!rows || !rows.length) return json({ error: "booking_not_found" }, 404);
  if (rows.some((r) => r.deposit_status === "paid")) return json({ error: "already_paid" }, 409);
  if (rows.some((r) => r.status === "cancelled")) return json({ error: "cancelled" }, 409);
  const total = rows.reduce((s, r) => s + Number(r.total_price || 0), 0);
  if (!(total > 0)) return json({ enabled: false, reason: "no_price" });
  const pct = Number((await cfg("deposit_pct")) || 20);
  const deposit = Math.round(total * pct) / 100;
  const { data: tour } = await admin.from("bc_tours").select("name, name_es").eq("id", rows[0].tour_id).maybeSingle();
  const tourName = (lang === "es" ? tour?.name_es || tour?.name : tour?.name) || "Baja Curated";
  const veh = rows.length;
  const name = lang === "es"
    ? `Depósito ${pct}% · ${tourName} · ${fmtDate(rows[0].booking_date, "es")} · ${veh} vehículo${veh > 1 ? "s" : ""}`
    : `${pct}% deposit · ${tourName} · ${fmtDate(rows[0].booking_date, "en")} · ${veh} vehicle${veh > 1 ? "s" : ""}`;
  const balance = Math.round((total - deposit) * 100) / 100;
  const desc = lang === "es"
    ? `Total del tour US$${total.toLocaleString("en-US")} con IVA incluido. Restante US$${balance.toLocaleString("en-US")} se paga en sitio. Reembolsable hasta 14 días antes.`
    : `Tour total US$${total.toLocaleString("en-US")}, VAT included. Remaining US$${balance.toLocaleString("en-US")} paid on site. Refundable up to 14 days before.`;
  await ensureWebhook(mode);
  const ref = rows[0].booking_ref;
  const group = rows[0].group_ref || "";
  const back = String(body.return_path || "/").startsWith("/") ? String(body.return_path || "/") : "/";
  const session = await stripe(mode, "POST", "checkout/sessions", {
    mode: "payment",
    locale: lang,
    customer_email: rows[0].client_email || undefined,
    client_reference_id: group || ref,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: cents(deposit), product_data: { name, description: desc } } }],
    metadata: { app: "baja_curated", product_code: "bc_deposit", group_ref: group, booking_ref: ref },
    payment_intent_data: { description: name, statement_descriptor_suffix: "BAJA CURATED", metadata: { app: "baja_curated", group_ref: group, booking_ref: ref } },
    success_url: `${SITE}${back}?pago=ok&session_id={CHECKOUT_SESSION_ID}#book`,
    cancel_url: `${SITE}${back}?pago=cancelado&ref=${encodeURIComponent(ref)}#book`,
  });
  const upd = { deposit_amount: deposit, deposit_status: "pending", stripe_session_id: session.id, payment_mode: mode };
  group ? await admin.from("bc_bookings").update(upd).eq("group_ref", group) : await admin.from("bc_bookings").update(upd).eq("booking_ref", ref);
  return json({ enabled: true, url: session.url, deposit, total });
}

async function confirm(body: any) {
  const sid = String(body.session_id || "");
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sid)) return json({ error: "bad_session" }, 400);
  const mode: Mode = sid.startsWith("cs_live_") ? "live" : "test";
  const session = await stripe(mode, "GET", `checkout/sessions/${sid}`);
  if (session?.metadata?.app !== "baja_curated") return json({ error: "not_ours" }, 400);
  const paid = await markPaid(session, mode);
  return json({ paid, booking_ref: session.metadata.booking_ref, deposit: (session.amount_total || 0) / 100 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const evt = new URL(req.url).searchParams.get("evt");
  try {
    if (evt === "test" || evt === "live") return await handleWebhook(req, evt);
    const body = await req.json().catch(() => ({}));
    if (body.action === "checkout") return await createCheckout(body);
    if (body.action === "confirmar") return await confirm(body);
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("bc-pagos", e);
    return json({ error: "server_error", detail: String((e as Error).message || e).slice(0, 200) }, 500);
  }
});
