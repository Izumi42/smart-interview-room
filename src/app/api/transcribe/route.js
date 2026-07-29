import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: 'Groq API Key missing' }, { status: 500 });
    }

    // Forward the form data directly to Groq Whisper
    const groqFormData = new FormData();
    groqFormData.append('file', file);
    groqFormData.append('model', 'whisper-large-v3');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`
        // Do NOT set Content-Type manually, fetch sets it with boundaries for FormData
      },
      body: groqFormData
    });

    const data = await res.json();
    
    if (!res.ok) {
      console.error("Groq Whisper Error:", data);
      return NextResponse.json({ error: data.error?.message || 'Transcription failed' }, { status: res.status });
    }

    return NextResponse.json({ text: data.text });
  } catch (error) {
    console.error("Transcription API Error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
