const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ACCOUNT_SID = process.env.PHONE_NUMBER_ID;
const AUTH_TOKEN = process.env.WHATSAPP_TOKEN;

const SYSTEM_PROMPT = `You are a helpful assistant for migrant workers working abroad. Your name is HelpBot.
You help workers with:
- Leave rights (sick leave, emergency leave, annual leave)
- Salary problems and delayed payments
- Vaccination and health requirements
- What to do if employer misbehaves
- Contract and visa guidance
- Embassy and helpline contacts
- Mental health and stress support
- Resignation and going home process

Rules:
- Be warm, kind and supportive
- Keep answers short (3-5 lines)
- Reply in the same language the worker writes in
- For emergencies always give helpline numbers first
- Say "check with your embassy" for specific legal advice`;

app.post('/webhook', async (req, res) => {
  try {
    const userText = req.body.Body;
    const from = req.body.From;

    if (!userText) return res.sendStatus(200);

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

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + 
            Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: 'whatsapp:+14155238886',
          To: from,
          Body: reply
        })
      }
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});
