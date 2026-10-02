/**
 * Webhook Vercel Edge — Pont WhatsApp Cloud API → Supabase (Lydia)
 * Fichier : api/webhook.js
 */

export const config = {
  runtime: 'edge',
};

export default async function handler(request, event) {
  const url = new URL(request.url);

  const VERIFY_TOKEN      = process.env.VERIFY_TOKEN;
  const SUPABASE_URL      = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const WEBHOOK_SECRET    = process.env.WEBHOOK_SECRET;

  // ── GET : Vérification du Webhook par Meta ──────────────────────────────
  if (request.method === 'GET') {
    const mode      = url.searchParams.get('hub.mode');
    const token     = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (!VERIFY_TOKEN) {
      console.error('[WEBHOOK GET] Erreur : VERIFY_TOKEN manquant dans Vercel');
      return new Response('Configuration Error', { status: 500 });
    }

    if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return new Response('Forbidden', { status: 403 });
  }

  // ── POST : Réception message WhatsApp & Relais asynchrone ────────────────
  if (request.method === 'POST') {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[WEBHOOK POST] Erreur : SUPABASE_URL ou SUPABASE_ANON_KEY manquant');
      return new Response('EVENT_RECEIVED', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    let payloadText = '';
    try {
      payloadText = await request.text();
    } catch (e) {
      return new Response('Bad Request', { status: 400 });
    }

    // Construction de l'URL cible avec le secret dynamique
    let targetUrl = SUPABASE_URL;
    if (WEBHOOK_SECRET) {
      const sep = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${sep}secret=${encodeURIComponent(WEBHOOK_SECRET)}`;
    }

    // Tâche d'arrière-plan vers Supabase (ne bloque pas la réponse à Meta)
    const forwardPromise = fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: payloadText,
    }).catch((err) =&gt; {
      console.error('[WEBHOOK RELAY] Erreur réseau:', err.message);
    });

    // Maintient la fonction active jusqu'à l'envoi complet sans bloquer la réponse HTTP
    if (event && typeof event.waitUntil === 'function') {
      event.waitUntil(forwardPromise);
    }

    // Réponse INSTANTANÉE à Meta (&lt; 20ms)
    return new Response('EVENT_RECEIVED', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
