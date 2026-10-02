// Désactive le parser automatique de Vercel pour garder le raw body
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  // 1. VERIFICATION META - Quand tu cliques sur "Vérifier" dans Meta
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      console.log('WEBHOOK VERIFIED');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Token invalide');
  }

  // 2. RECEPTION DES MESSAGES
  if (req.method === 'POST') {
    const rawBody = await getRawBody(req);
    
    // Réponds 200 IMMÉDIATEMENT - c'est obligatoire pour 1000 conv/jour
    res.status(200).send('EVENT_RECEIVED');

    // Tout ton traitement IA se fait APRES
    try {
      const data = JSON.parse(rawBody);
      console.log('Message reçu:', JSON.stringify(data, null, 2));
      
      // ICI tu appelles ton agent IA en arrière-plan
      // Exemple: fetch('https://api.openai.com/...')
      // Puis tu renvoies la réponse avec l'API WhatsApp/Messenger
      
    } catch (e) {
      console.error(e);
    }
    return;
  }

  return res.status(405).send('Method not allowed');
}
