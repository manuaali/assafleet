import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper: base64url decode to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Helper: Uint8Array to base64url
function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = "";
  for (const byte of arr) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Create VAPID JWT
async function createVapidJwt(
  privateKeyJwk: JsonWebKey,
  audience: string,
  subject: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(unsignedToken)
  );

  const sigBytes = new Uint8Array(signature);
  const signatureB64 = uint8ArrayToBase64Url(sigBytes);

  return `${unsignedToken}.${signatureB64}`;
}

// Encrypt push message payload using Web Push encryption (aes128gcm)
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();

  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  const subscriberPublicKey = await crypto.subtle.importKey(
    "raw",
    base64UrlToUint8Array(p256dhKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberPublicKey },
      localKeyPair.privateKey,
      256
    )
  );

  const authSecretBytes = base64UrlToUint8Array(authSecret);

  const ikmInfo = encoder.encode("WebPush: info\0");
  const ikmInfoFull = new Uint8Array(ikmInfo.length + 65 + 65);
  ikmInfoFull.set(ikmInfo);
  ikmInfoFull.set(base64UrlToUint8Array(p256dhKey), ikmInfo.length);
  ikmInfoFull.set(localPublicKeyRaw, ikmInfo.length + 65);

  const ikmKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);
  const prkIkm = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecretBytes, info: ikmInfoFull },
    ikmKey,
    256
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const prkKey = await crypto.subtle.importKey("raw", prkIkm, "HKDF", false, ["deriveBits"]);
  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt, info: cekInfo },
    prkKey,
    128
  );

  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt, info: nonceInfo },
    prkKey,
    96
  );

  const contentKey = await crypto.subtle.importKey("raw", cekBits, "AES-GCM", false, ["encrypt"]);

  const payloadBytes = encoder.encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2;

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonceBits },
      contentKey,
      paddedPayload
    )
  );

  const rs = 4096;
  const header_bytes = new Uint8Array(16 + 4 + 1 + 65);
  header_bytes.set(salt);
  header_bytes[16] = (rs >> 24) & 0xff;
  header_bytes[17] = (rs >> 16) & 0xff;
  header_bytes[18] = (rs >> 8) & 0xff;
  header_bytes[19] = rs & 0xff;
  header_bytes[20] = 65;
  header_bytes.set(localPublicKeyRaw, 21);

  const body = new Uint8Array(header_bytes.length + encrypted.length);
  body.set(header_bytes);
  body.set(encrypted, header_bytes.length);

  return { encrypted: body, salt, localPublicKey: localPublicKeyRaw };
}

async function sendPushToSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPrivateKeyJwk: JsonWebKey,
  vapidPublicKeyBase64Url: string,
  vapidSubject: string
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.hostname}`;

    const jwt = await createVapidJwt(vapidPrivateKeyJwk, audience, vapidSubject);
    const { encrypted } = await encryptPayload(payload, subscription.p256dh, subscription.auth);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        Authorization: `vapid t=${jwt}, k=${vapidPublicKeyBase64Url}`,
        TTL: "86400",
        Urgency: "normal",
      },
      body: encrypted,
    });

    if (response.status === 410 || response.status === 404) {
      return false;
    }

    return response.ok;
  } catch (error) {
    console.error("Error sending push:", error);
    return false;
  }
}

/**
 * Check which users have overdue mileage or inspection and send reminders.
 * Only sends to users where reminders_enabled = true in profiles.
 */
async function handleDailyReminders(supabase: any, vapidPrivateKeyJwk: JsonWebKey, vapidPublicKey: string, vapidSubject: string) {
  const now = new Date();
  
  // Get all active vehicles with assigned users
  const { data: vehicles, error: vErr } = await supabase
    .from("vehicles")
    .select("id, responsible_user_id")
    .eq("status", "active")
    .not("responsible_user_id", "is", null);
  
  if (vErr || !vehicles || vehicles.length === 0) {
    console.log("No active vehicles with users found");
    return { sent: 0, failed: 0 };
  }

  const userIds = [...new Set(vehicles.map((v: any) => v.responsible_user_id))];
  
  // Get profiles with reminders_enabled
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, reminders_enabled")
    .in("user_id", userIds)
    .eq("reminders_enabled", true);
  
  const enabledUserIds = new Set((profiles || []).map((p: any) => p.user_id));
  
  // Filter vehicles to only those with reminders enabled
  const eligibleVehicles = vehicles.filter((v: any) => enabledUserIds.has(v.responsible_user_id));
  
  if (eligibleVehicles.length === 0) {
    console.log("No users with reminders enabled");
    return { sent: 0, failed: 0 };
  }

  const vehicleIds = eligibleVehicles.map((v: any) => v.id);
  const eligibleUserIds = [...new Set(eligibleVehicles.map((v: any) => v.responsible_user_id))];

  // --- Check mileage overdue ---
  // Get current week's Monday
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const currentWeekMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  
  // Get latest mileage log per vehicle this week
  const { data: mileageLogs } = await supabase
    .from("mileage_logs")
    .select("vehicle_id, logged_at")
    .in("vehicle_id", vehicleIds)
    .gte("logged_at", currentWeekMonday.toISOString())
    .order("logged_at", { ascending: false });
  
  const vehiclesWithMileageThisWeek = new Set((mileageLogs || []).map((l: any) => l.vehicle_id));
  
  // Users with overdue mileage
  const mileageOverdueUserIds = new Set<string>();
  eligibleVehicles.forEach((v: any) => {
    if (!vehiclesWithMileageThisWeek.has(v.id)) {
      mileageOverdueUserIds.add(v.responsible_user_id);
    }
  });

  // --- Check inspection overdue ---
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  
  const { data: inspections } = await supabase
    .from("vehicle_inspections")
    .select("vehicle_id, status")
    .in("vehicle_id", vehicleIds)
    .eq("inspection_month", currentMonth)
    .eq("status", "completed");
  
  const vehiclesWithInspection = new Set((inspections || []).map((i: any) => i.vehicle_id));
  
  const inspectionOverdueUserIds = new Set<string>();
  eligibleVehicles.forEach((v: any) => {
    if (!vehiclesWithInspection.has(v.id)) {
      inspectionOverdueUserIds.add(v.responsible_user_id);
    }
  });

  // Combine user IDs that need reminders
  const usersNeedingReminder = new Map<string, string[]>();
  
  mileageOverdueUserIds.forEach(uid => {
    if (!usersNeedingReminder.has(uid)) usersNeedingReminder.set(uid, []);
    usersNeedingReminder.get(uid)!.push("mileage");
  });
  
  inspectionOverdueUserIds.forEach(uid => {
    if (!usersNeedingReminder.has(uid)) usersNeedingReminder.set(uid, []);
    usersNeedingReminder.get(uid)!.push("inspection");
  });

  if (usersNeedingReminder.size === 0) {
    console.log("No overdue items found");
    return { sent: 0, failed: 0 };
  }

  // Get push subscriptions for these users
  const reminderUserIds = [...usersNeedingReminder.keys()];
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("*")
    .in("user_id", reminderUserIds);

  if (!subscriptions || subscriptions.length === 0) {
    console.log("No push subscriptions for users needing reminders");
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  for (const sub of subscriptions) {
    const overdueTypes = usersNeedingReminder.get(sub.user_id) || [];
    
    let title = "Muistutus";
    let body = "";
    let tag = "daily-reminder";
    let url = "/my-vehicle";

    if (overdueTypes.includes("mileage") && overdueTypes.includes("inspection")) {
      title = "Kilometrikirjaus ja tarkastus tekemättä";
      body = "Kilometrikirjaus ja kuukausitarkastus odottavat suorittamista.";
      tag = "mileage-inspection";
    } else if (overdueTypes.includes("mileage")) {
      title = "Kilometrikirjaus tekemättä";
      body = "Muista kirjata ajoneuvosi kilometrit!";
      tag = "mileage";
    } else if (overdueTypes.includes("inspection")) {
      title = "Kuukausitarkastus tekemättä";
      body = "Kuukausitarkastus odottaa suorittamista.";
      tag = "inspection";
      url = "/vehicle-inspection";
    }

    const payload = JSON.stringify({ title, body, tag, url });

    const success = await sendPushToSubscription(
      sub, payload, vapidPrivateKeyJwk, vapidPublicKey, vapidSubject
    );
    if (success) {
      sent++;
    } else {
      failed++;
      expiredEndpoints.push(sub.endpoint);
    }
  }

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expiredEndpoints);
  }

  return { sent, failed, total: subscriptions.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authentication: allow service-role calls (cron) or authenticated admin users
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === supabaseServiceKey;

    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .single();
      const role = roleData?.role;
      if (role !== "admin" && role !== "superadmin") {
        return new Response(
          JSON.stringify({ error: "Forbidden: admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const vapidPrivateKeyJson = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");

    if (!vapidPrivateKeyJson || !vapidPublicKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vapidPrivateKeyJwk = JSON.parse(vapidPrivateKeyJson);
    const vapidSubject = "mailto:admin@example.com";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { type, user_ids } = body;

    // Handle daily reminder cron - checks overdue status per user
    if (type === "daily_reminder") {
      const result = await handleDailyReminders(supabase, vapidPrivateKeyJwk, vapidPublicKey, vapidSubject);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Manual / specific notification types
    let title = "Muistutus";
    let notifBody = "Sinulla on uusi muistutus.";
    let tag = "reminder";
    let url = "/";

    switch (type) {
      case "mileage_reminder":
        title = "Kilometrikirjaus";
        notifBody = "Muista kirjata ajoneuvosi kilometrit tällä viikolla!";
        tag = "mileage";
        url = "/my-vehicle";
        break;
      case "inspection_reminder":
        title = "Kuukausitarkastus";
        notifBody = "Kuukausitarkastus on ajankohtainen. Suorita tarkastus sovelluksessa.";
        tag = "inspection";
        url = "/vehicle-inspection";
        break;
      default:
        if (body.title) title = body.title;
        if (body.body) notifBody = body.body;
        if (body.url) url = body.url;
    }

    const payload = JSON.stringify({ title, body: notifBody, tag, url });

    // Get subscriptions
    let query = supabase.from("push_subscriptions").select("*");
    if (user_ids && user_ids.length > 0) {
      query = query.in("user_id", user_ids);
    }

    const { data: subscriptions, error } = await query;
    if (error) throw error;

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions || []) {
      const success = await sendPushToSubscription(
        sub, payload, vapidPrivateKeyJwk, vapidPublicKey, vapidSubject
      );
      if (success) {
        sent++;
      } else {
        failed++;
        expiredEndpoints.push(sub.endpoint);
      }
    }

    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    return new Response(
      JSON.stringify({ sent, failed, total: subscriptions?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
