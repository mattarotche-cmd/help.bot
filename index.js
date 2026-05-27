const express = require('express');
const app = express();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const SYSTEM_PROMPT = `You are a helpful assistant for migrant workers working abroad in unorganised sectors. Your name is HelpBot. 
You help workers with questions about:
- Their rights as workers (leave, rest days, overtime)
- Vaccination and health requirements
- What to do if employer is not paying salary
- How to apply for sick leave or emergency leave
- Contract and visa related general guidance
- Who to call in emergencies (embassy, labour helpline)
- Mental health support and where to get help
- End of contract, resignation, and going home process

Rules:
- Be warm, kind, and supportive. Workers may be scared or stressed.
- Keep answers short and simple (3-5 lines maximum).
- If you don't know the exact law of a country, say "Please check with your embassy or a local support organization."
- Never give legal advice — only general guidance and information.
- If someone seems in danger or distress, always give emergency contact advice first.
- Respond in the same language the worker writes in (Malayalam, Hindi, Tamil, English, Arabic, etc.)`;

// Webhook verification (WhatsApp checks this once when you set up)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receive messages from WhatsApp
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message && message.type === 'text') {
        const userText = message.text.body;
        const from = message.from;

        // Get AI answer from Gemini
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userText }] }],
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
            })
          }
        );
        const geminiData = await geminiRes.json();
        const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
          || "Sorry, I could not process your message. Please try again.";

        // Send reply back to WhatsApp
        await fetch(
          `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${WHATSAPP_TOKEN}`
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: from,
              type: 'text',
              text: { body: reply }
            })
          }
        );
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
