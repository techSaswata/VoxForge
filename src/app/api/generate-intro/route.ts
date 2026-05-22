import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { Question } from '@/lib/types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MURF_API_KEY = process.env.MURF_API_KEY;

// Retry helper
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
    let lastError: Error | null = null;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            if (i === maxRetries) return response;
        } catch (error) {
            lastError = error as Error;
            console.log(`TTS attempt ${i + 1} failed, retrying...`);
            await new Promise(r => setTimeout(r, 500 * (i + 1)));
        }
    }
    throw lastError || new Error('Fetch failed after retries');
}

// Type-specific intro prompts
function getIntroPrompt(interviewType: string, isFirstQuestion: boolean): string {
    // For subsequent questions, skip greetings entirely
    const subsequentPrompt = `You are continuing a technical interview. Generate a BRIEF transition to the next question.
Keep it under 2 sentences. Do NOT say "Hello", "Hi", "Welcome", or any greeting - you're already mid-interview.
Just say something like "Great, let's move on to..." or "Now let's discuss..." then the topic.
Do NOT repeat what they answered before.`;

    if (!isFirstQuestion) {
        return subsequentPrompt;
    }

    // First question prompts (with greeting)
    const prompts: Record<string, string> = {
        dsa: `You are a friendly technical interviewer. Generate a brief introduction for a coding interview question. 
Keep it under 3 sentences. Be warm but professional.
Include: A brief greeting, the problem name, a one-line summary, and ask them to share their approach.
Do NOT include full problem details - they can read those themselves.`,

        frontend: `You are a friendly frontend development interviewer. Generate a brief introduction for a technical discussion.
Keep it under 3 sentences. Be conversational and encouraging.
Mention the topic, give context on what you want to discuss, and invite them to share their experience.`,

        backend: `You are a friendly backend development interviewer. Generate a brief introduction for a technical discussion.
Keep it under 3 sentences. Be professional and encouraging.
Mention the topic and invite them to share their knowledge and experience.`,

        fullstack: `You are a friendly fullstack development interviewer. Generate a brief introduction for a technical discussion.
Keep it under 3 sentences. Be conversational.
Mention the topic and set the stage for discussing both frontend and backend aspects.`,

        cybersecurity: `You are a friendly cybersecurity interviewer. Generate a brief introduction for a security-focused discussion.
Keep it under 3 sentences. Be professional.
Mention the topic and invite them to share their security knowledge and experience.`,

        devops: `You are a friendly DevOps interviewer. Generate a brief introduction for a technical discussion.
Keep it under 3 sentences. Be encouraging.
Mention the topic and invite them to share their experience with infrastructure and operations.`
    };

    return prompts[interviewType] || prompts.dsa;
}

export async function POST(req: Request) {
    const totalStart = Date.now();

    try {
        const body = await req.json();
        const { question, interviewType = 'dsa', isFirstQuestion = true, voiceId = 'en-US-matthew' } = body as {
            question: Question;
            interviewType?: string;
            isFirstQuestion?: boolean;
            voiceId?: string;
        };

        if (!question) {
            return NextResponse.json({ error: 'No question provided' }, { status: 400 });
        }

        // ⏱️ TIMING: LLM Intro Generation
        const llmStart = Date.now();
        let introText: string;
        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: getIntroPrompt(interviewType, isFirstQuestion)
                    },
                    {
                        role: 'user',
                        content: isFirstQuestion
                            ? `Generate an intro for this ${interviewType === 'dsa' ? 'question' : 'topic'}:
Title: ${question.title}
Description: ${question.description}`
                            : `Generate a brief transition to this next ${interviewType === 'dsa' ? 'question' : 'topic'}:
Title: ${question.title}
Description: ${question.description}`
                    }
                ],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.7,
                max_tokens: 150,
            });

            introText = completion.choices[0]?.message?.content || '';
        } catch (llmError) {
            console.error('LLM Error:', llmError);
            introText = '';
        }
        const llmTime = Date.now() - llmStart;
        console.log(`⏱️ INTRO LLM: ${llmTime}ms`);

        // Use fallback if empty
        if (!introText || introText.length < 10) {
            introText = interviewType === 'dsa'
                ? `Hi! Today's problem is "${question.title}". Take a moment to read it, and when you're ready, walk me through your approach.`
                : `Hi! Let's discuss "${question.title}". I'd love to hear your thoughts and experience on this topic.`;
        }

        console.log('Generated intro:', introText);

        // ⏱️ TIMING: TTS Generation
        if (!MURF_API_KEY) {
            console.error('MURF_API_KEY not set');
            return NextResponse.json({ introText, audioBase64: null });
        }

        const ttsStart = Date.now();
        const murfUrl = 'https://global.api.murf.ai/v1/speech/stream';

        // Extract locale from voice ID (e.g., 'en-US-matthew' -> 'en-US')
        const locale = voiceId.split('-').slice(0, 2).join('-');

        const murfPayload = {
            voiceId: voiceId,
            text: introText,
            multiNativeLocale: locale,
            model: 'FALCON',
            format: 'MP3',
            sampleRate: 24000,
            channelType: 'MONO'
        };

        try {
            const murfResponse = await fetchWithRetry(murfUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': MURF_API_KEY
                },
                body: JSON.stringify(murfPayload)
            });

            const ttsTime = Date.now() - ttsStart;
            console.log(`⏱️ INTRO TTS: ${ttsTime}ms`);

            if (!murfResponse.ok) {
                const errText = await murfResponse.text();
                console.error('Murf TTS Error:', errText);
                return NextResponse.json({ introText, audioBase64: null });
            }

            const audioArrayBuffer = await murfResponse.arrayBuffer();

            if (audioArrayBuffer.byteLength < 1000) {
                console.error('Audio data too small, likely invalid');
                return NextResponse.json({ introText, audioBase64: null });
            }

            const audioBase64 = Buffer.from(audioArrayBuffer).toString('base64');

            const totalTime = Date.now() - totalStart;
            console.log(`⏱️ INTRO TOTAL: ${totalTime}ms (LLM: ${llmTime}ms, TTS: ${ttsTime}ms)`);

            return NextResponse.json({
                introText,
                audioBase64,
                timing: { llm: llmTime, tts: ttsTime, total: totalTime }
            });
        } catch (ttsError) {
            console.error('TTS Error after retries:', ttsError);
            return NextResponse.json({ introText, audioBase64: null });
        }

    } catch (error) {
        console.error('Intro Generation Error:', error);
        return NextResponse.json({
            introText: "Hi! Let's get started. Tell me about your approach to this topic.",
            audioBase64: null
        });
    }
}
