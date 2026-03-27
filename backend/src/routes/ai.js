const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `
You are an AI Recruitment Assistant for HireAI. Your goal is to help candidates build a professional profile through conversation.
As they talk about their experience, you should:
1. Be encouraging and professional.
2. Ask follow-up questions about their specific roles, tech stacks, or durations if they are missing.
3. ALWAYS return a JSON object at the end of your response if you detect new data.

JSON format to include in your tag [[DATA]]:
{
  "experience": { "role": "", "company": "", "duration": "", "description": "" },
  "skills": [{ "name": "", "level": "Beginner|Intermediate|Expert" }],
  "projects": { "title": "", "description": "", "tech_stack": [] }
}
If no new data is found, just reply with text.
`;

router.post('/chat', authenticate, async (req, res) => {
    const { message, history = [] } = req.body;

    try {
        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [...history, { role: 'user', parts: [{ text: message }] }],
                generationConfig: { 
                    temperature: 0.7, 
                    maxOutputTokens: 800 
                }
            })
        });

        const data = await response.json();
        
        if (!data.candidates) {
            console.error('Gemini Error:', data);
            return res.status(500).json({ error: 'AI communication failed' });
        }

        const aiResponse = data.candidates[0].content.parts[0].text;

        // Save the interaction to ai_sessions table
        const updatedHistory = [...history, 
            { role: 'user', parts: [{ text: message }] },
            { role: 'model', parts: [{ text: aiResponse }] }
        ];

        db.prepare('INSERT OR REPLACE INTO ai_sessions (id, user_id, messages) VALUES (?, ?, ?)')
          .run(req.user.id, req.user.id, JSON.stringify(updatedHistory));

        res.json({ 
            reply: aiResponse,
            history: updatedHistory
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/ai/session -> get the current chat history
router.get('/session', authenticate, (req, res) => {
    const session = db.prepare('SELECT messages FROM ai_sessions WHERE user_id = ?').get(req.user.id);
    res.json({ history: session ? JSON.parse(session.messages) : [] });
});

// DELETE /api/ai/session -> Clear chat
router.delete('/session', authenticate, (req, res) => {
    db.prepare('DELETE FROM ai_sessions WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'Session reset' });
});

module.exports = router;