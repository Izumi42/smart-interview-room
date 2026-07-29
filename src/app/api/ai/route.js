import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { transcript, type, agendaItems, agent, apiKey } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'AI API key not configured. Please enter it in the home page.' }, { status: 400 });
    }

    let prompt = '';
    let responseFormat = 'text/plain';

    if (type === 'evaluate_agenda') {
      prompt = `You are an expert technical interviewer's assistant. Based on the following interview transcript, review the pending agenda items. IMPORTANT: An agenda item should ONLY be considered addressed if the CANDIDATE provides an answer or explanation related to it. If only the Interviewer mentions it, or if it is just being asked, DO NOT check it off. If the candidate has sufficiently answered any of the agenda items, return a JSON array containing the IDs of those items. Return ONLY a valid JSON array of strings (e.g., ["id1", "id2"]). Return an empty array [] if none have been addressed.\n\nPending Agenda Items:\n${JSON.stringify(agendaItems)}\n\nTranscript:\n${transcript}`;
      responseFormat = 'application/json';
    } else {
      prompt = `You are an expert technical interviewer's assistant. Based on the following interview transcript, generate 3 highly relevant and insightful follow-up questions to ask the candidate. Keep them concise and challenging but fair.\n\nCRITICAL FORMATTING RULE: Output ONLY the 3 questions, each on a new line. Do NOT include any introductory text, conversational filler, or ending text. Do NOT include quotes inside the questions (e.g., no "To jump right in..."). Just the raw, direct questions. Start each question with a number.\n\nTranscript:\n${transcript}`;
    }

    const targetAgent = agent || 'groq';

    try {
      if (targetAgent === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [{ role: "user", content: prompt }]
          })
        });
        const data = await res.json();
        if (data.choices && data.choices[0].message.content) {
          let text = data.choices[0].message.content;
          if (type === 'evaluate_agenda') {
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(text);
            return NextResponse.json({ answeredIds: Array.isArray(parsed) ? parsed : [] });
          }
          return NextResponse.json({ questions: text.trim() });
        }
        return NextResponse.json({ error: data.error?.message || 'Groq API Error: ' + JSON.stringify(data) }, { status: 500 });
      } 
      
      else if (targetAgent === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await res.json();
        if (data.choices && data.choices[0].message.content) {
          let text = data.choices[0].message.content;
          if (type === 'evaluate_agenda') {
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(text);
            return NextResponse.json({ answeredIds: Array.isArray(parsed) ? parsed : [] });
          }
          return NextResponse.json({ questions: text.trim() });
        }
        return NextResponse.json({ error: data.error?.message || 'OpenAI API Error: ' + JSON.stringify(data) }, { status: 500 });
      }

      else if (targetAgent === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(text);
            return NextResponse.json({ answeredIds: Array.isArray(parsed) ? parsed : [] });
          }
          return NextResponse.json({ questions: text.trim() });
        }
        return NextResponse.json({ error: data.error?.message || 'Gemini API Error: ' + JSON.stringify(data) }, { status: 500 });
      }

      else if (targetAgent === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await res.json();
        if (data.content && data.content[0].text) {
          let text = data.content[0].text;
          if (type === 'evaluate_agenda') {
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(text);
            return NextResponse.json({ answeredIds: Array.isArray(parsed) ? parsed : [] });
          }
          return NextResponse.json({ questions: text.trim() });
        }
        return NextResponse.json({ error: data.error?.message || 'Anthropic API Error: ' + JSON.stringify(data) }, { status: 500 });
      }

      return NextResponse.json({ error: 'Unknown AI Agent' }, { status: 400 });

    } catch (apiError) {
      console.error(`AI API Error (${targetAgent}):`, apiError);
      return NextResponse.json({ error: `Failed to call ${targetAgent} API: ${apiError.message}` }, { status: 500 });
    }

  } catch (error) {
    console.error("Internal Server Error:", error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
