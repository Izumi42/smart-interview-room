import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { transcript, type, agendaItems } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }

    const googleKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    let prompt = '';
    let responseFormat = 'text/plain';

    if (type === 'scorecard') {
      prompt = `You are an expert technical interviewer. Based on the following interview transcript, generate a brief, professional Candidate Scorecard. Include a summary of their performance, key strengths, areas for improvement, and a final recommendation.\n\nTranscript:\n${transcript}`;
    } else if (type === 'evaluate_agenda') {
      prompt = `You are an expert technical interviewer's assistant. Based on the following interview transcript, review the pending agenda items. IMPORTANT: An agenda item should ONLY be considered addressed if the CANDIDATE provides an answer or explanation related to it. If only the Interviewer mentions it, or if it is just being asked, DO NOT check it off. If the candidate has sufficiently answered any of the agenda items, return a JSON array containing the IDs of those items. Return ONLY a valid JSON array of strings (e.g., ["id1", "id2"]). Return an empty array [] if none have been addressed.\n\nPending Agenda Items:\n${JSON.stringify(agendaItems)}\n\nTranscript:\n${transcript}`;
      responseFormat = 'application/json';
    } else {
      prompt = `You are an expert technical interviewer's assistant. Based on the following interview transcript, generate 3 highly relevant and insightful follow-up questions to ask the candidate. Keep them concise and challenging but fair.\n\nCRITICAL FORMATTING RULE: Output ONLY the 3 questions, each on a new line. Do NOT include any introductory text, conversational filler, or ending text. Do NOT include quotes inside the questions (e.g., no "To jump right in..."). Just the raw, direct questions. Start each question with a number.\n\nTranscript:\n${transcript}`;
    }

    if (groqKey) {
      // Groq integration for ultra-fast Llama-3 responses
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: "llama3-8b-8192", // Faster, lighter model with better free-tier rate limits
            messages: [{ role: "user", content: prompt }]
          })
        });
        const data = await res.json();
        
        if (data.choices && data.choices[0].message.content) {
          let text = data.choices[0].message.content;
          if (type === 'evaluate_agenda') {
            try {
              text = text.replace(/```json/g, '').replace(/```/g, '').trim();
              const parsed = JSON.parse(text);
              return NextResponse.json({ answeredIds: Array.isArray(parsed) ? parsed : [] });
            } catch (e) {
              console.error("Failed to parse Groq evaluate_agenda response:", text, e);
              return NextResponse.json({ answeredIds: [] });
            }
          }
          return NextResponse.json({ questions: text.trim() });
        } else {
          console.error("Groq API Error Response:", JSON.stringify(data, null, 2));
        }
      } catch (err) {
        console.error("Groq API Fetch failed:", err);
      }
    } else if (googleKey) {
      // Basic Google Gemini API Integration (v1beta)
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${googleKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: responseFormat
            }
          })
        });
        const data = await res.json();
        if (data.candidates && data.candidates[0].content.parts[0].text) {
          let text = data.candidates[0].content.parts[0].text;
          if (type === 'evaluate_agenda') {
            try {
              text = text.replace(/```json/g, '').replace(/```/g, '').trim();
              const parsed = JSON.parse(text);
              return NextResponse.json({ answeredIds: Array.isArray(parsed) ? parsed : [] });
            } catch (e) {
              console.error("Failed to parse AI evaluate_agenda response:", text, e);
              return NextResponse.json({ answeredIds: [] });
            }
          }
          return NextResponse.json({ questions: text });
        } else {
          console.error("Gemini API Error Response:", JSON.stringify(data, null, 2));
        }
      } catch (err) {
        console.error("Gemini API Fetch failed:", err);
      }
    } else if (openaiKey) {
      // Basic OpenAI Integration
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await res.json();
      if (data.choices && data.choices[0].message.content) {
        return NextResponse.json({ questions: data.choices[0].message.content });
      }
    }

    // If no keys are provided, return an error
    console.error("No AI API Keys found in environment variables.");
    return NextResponse.json({ error: 'AI API keys not configured. Please add GROQ_API_KEY to your .env.local' }, { status: 500 });

  } catch (error) {
    console.error("AI API Error:", error);
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}
