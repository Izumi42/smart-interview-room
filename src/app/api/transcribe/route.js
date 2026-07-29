import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const apiKey = formData.get('apiKey');
    const agent = formData.get('agent') || 'groq';
    const context = formData.get('context') || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is required for transcription' }, { status: 400 });
    }

    let useGroq = false;
    let useOpenAI = false;

    if (apiKey.startsWith('gsk_') || agent === 'groq') {
      useGroq = true;
    } else if (apiKey.startsWith('sk-') || agent === 'openai' || agent === 'gemini' || agent === 'anthropic') {
      useOpenAI = true;
    }

    if (useGroq) {
      const groqFormData = new FormData();
      groqFormData.append('file', file);
      groqFormData.append('model', 'whisper-large-v3');
      groqFormData.append('language', 'en');
      groqFormData.append('prompt', `This is a professional interview. The speaker is talking clearly in English. Keywords: ${context}`);

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: groqFormData
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: data.error?.message || 'Groq Transcription failed' }, { status: res.status });
      }
      return NextResponse.json({ text: data.text });
    } 
    
    else if (useOpenAI) {
      const openaiFormData = new FormData();
      openaiFormData.append('file', file);
      openaiFormData.append('model', 'whisper-1');
      openaiFormData.append('language', 'en');
      openaiFormData.append('prompt', `This is a professional interview. The speaker is talking clearly in English. Keywords: ${context}`);

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: openaiFormData
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: data.error?.message || 'OpenAI Transcription failed' }, { status: res.status });
      }
      return NextResponse.json({ text: data.text });
    }

    return NextResponse.json({ error: 'Transcription requires a valid Groq (gsk_) or OpenAI (sk-) API Key.' }, { status: 400 });

  } catch (error) {
    console.error("Transcription API Error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
