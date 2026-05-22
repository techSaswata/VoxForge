import { NextResponse } from 'next/server';
import { createClient } from '@deepgram/sdk';
import { Groq } from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import { Message, Question, Example } from '@/lib/types';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

// Initialize Clients
const deepgram = createClient(process.env.DEEPGRAM_API_KEY ?? '');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

//Constants
const MURF_API_KEY = process.env.MURF_API_KEY;

const NEXT_QUESTION_TRIGGERS = [
    'next question',
    'move on',
    'next problem',
    'different question',
    'another question',
    'skip',
    'done with this',
    'let\'s move on',
    'i\'m done',
    'finished'
];

export async function POST(req: Request) {
    const totalStart = Date.now();

    try {
        const supabase = await createSupabaseClient();

        //Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const audioFile = formData.get('audio') as Blob;
        const sessionId = formData.get('sessionId') as string;

        if (!audioFile) {
            return NextResponse.json({ error: 'Missing audio' }, { status: 400 });
        }

        //Fetch state from DATABASE, not client
        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }

        const { data: session, error: sessionError } = await supabase
            .from('interview_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('user_id', user.id)
            .single();

        if (sessionError || !session) {
            console.error('Session fetch error:', sessionError);
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // SECURITY: Reject if session is not active (source of truth)
        if (session.status !== 'active') {
            console.log(`❌ Rejected process-turn: session ${sessionId} is ${session.status}`);
            return NextResponse.json({
                error: 'Interview is no longer active',
                shouldEndInterview: true,
                redirectTo: session.status === 'completed' ? `/feedback/${sessionId}` : '/dashboard'
            }, { status: 403 });
        }

        // Get state from DATABASE (source of truth)
        const conversationHistory: Message[] = (session.messages as unknown as Message[]) || [];
        const maxQuestions = session.num_questions;
        const code = formData.get('code') as string || '';

        //Check question status from DB instead of index
        const { data: activeQuestion } = await supabase
            .from('interview_questions')
            .select('question_order, question_title')
            .eq('session_id', sessionId)
            .eq('status', 'active')
            .single();

        const currentQuestionTitle = activeQuestion?.question_title || '';
        const currentQuestionIndex = activeQuestion ? activeQuestion.question_order - 1 : 0;

        //Check if there are any questions left
        const { count } = await supabase
            .from('interview_questions')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sessionId)
            .in('status', ['active', 'pending']);

        const questionsRemaining = count || 0;
        const isFinalQuestion = questionsRemaining === 1;
        const hasReachedLimit = questionsRemaining === 0;

        if (hasReachedLimit) {
            console.log('No more questions - interview complete');
            return NextResponse.json({
                error: 'Interview complete',
                shouldEndInterview: true
            }, { status: 200 }); // Changed to 200, not an error
        }

        //STT:Deepgram SDK (Nova-2)
        const sttStart = Date.now();
        const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            audioBuffer,
            {
                model: 'nova-2',
                smart_format: true,
                language: 'en-US',
            }
        );

        if (error) {
            console.error('Deepgram Error:', error);
            throw new Error(`Deepgram STT failed: ${error.message}`);
        }

        const userTranscript = result?.results?.channels[0]?.alternatives[0]?.transcript;
        const sttTime = Date.now() - sttStart;
        console.log(`⏱️ STT: ${sttTime}ms`);

        if (!userTranscript) {
            return NextResponse.json({ error: 'No speech detected' }, { status: 400 });
        }

        console.log('User said:', userTranscript);

        //LLM: Groq (Llama 3.3) with STRUCTURED OUTPUT
        const { data: dbQuestion } = await supabase
            .from('interview_questions')
            .select('question_title, question_description, question_type, question_difficulty, followup_count')
            .eq('session_id', sessionId)
            .eq('status', 'active')
            .single();

        const actualQuestionTitle = dbQuestion?.question_title || currentQuestionTitle;
        const actualQuestionDescription = dbQuestion?.question_description || '';
        const actualQuestionType = dbQuestion?.question_type || session.interview_type;
        const actualDifficulty = dbQuestion?.question_difficulty || 'Medium';
        const currentFollowupCount = dbQuestion?.followup_count || 0;

        // DIFFICULTY-BASED FOLLOW-UP LIMITS
        const followupLimits: Record<string, number> = {
            'Easy': 1,
            'Medium': 2,
            'Hard': 3
        };
        const maxFollowups = followupLimits[actualDifficulty] || 2;
        const followupsRemaining = maxFollowups - currentFollowupCount;

        const systemPrompt = `You are an expert technical interviewer conducting a ${actualQuestionType.toUpperCase()} interview.

=== CRITICAL: STAY ON THIS EXACT QUESTION ===
QUESTION TITLE: "${actualQuestionTitle}"
QUESTION DESCRIPTION: ${actualQuestionDescription}
DIFFICULTY: ${actualDifficulty}

THIS IS THE ONLY QUESTION YOU ARE EVALUATING. DO NOT:
- Ask about other topics or programming languages
- Generate new coding problems  
- Deviate from the question above
- Ask DSA questions if this is a Backend/Frontend/etc interview

YOUR ONLY JOB:
1. Evaluate the candidate's answer to THE QUESTION ABOVE
2. Ask clarifying follow-ups ABOUT THE QUESTION ABOVE
3. Correct errors in their explanation or code
4. Guide them if stuck with hints RELATED TO THE QUESTION ABOVE

=== FOLLOW-UP RULES (${actualDifficulty} DIFFICULTY) ===
- Maximum follow-ups for this question: ${maxFollowups}
- Follow-ups asked so far: ${currentFollowupCount}
- Follow-ups remaining: ${followupsRemaining}

${followupsRemaining > 0 ? `
YOU MUST ASK ${followupsRemaining} MORE FOLLOW-UP(S) before marking complete:
- If user's answer is incomplete, ask for clarification
- If user's code has bugs, point them out and ask to fix
- If user's explanation is wrong, correct them and ask follow-up
- Ask about edge cases, complexity, or alternative approaches
- Each follow-up must be BASED ON what the user said/wrote
` : `
ALL FOLLOW-UPS EXHAUSTED. You must now:
- Give brief final evaluation of their answer
- Mark [STATUS:COMPLETE] to move to next question
- Do NOT ask more questions about this topic
`}

Current Code State:
\`\`\`
${code}
\`\`\`

Interview Progress:
- This is question ${currentQuestionIndex + 1} of ${maxQuestions}
${isFinalQuestion ? '- THIS IS THE FINAL QUESTION. After evaluation, interview ends.' : ''}

RESPONSE STYLE:
- Be encouraging, conversational, and CONCISE (2-3 sentences max)
- Ask ONE focused follow-up at a time about THE QUESTION ABOVE
- If candidate is off-topic, gently redirect: "Let's focus on ${actualQuestionTitle}..."
- Don't repeat what they just said
- Correct errors constructively: "I noticed X, can you fix that?"

STATUS TAGS (REQUIRED):
- [STATUS:COMPLETE] = ALL follow-ups done (${currentFollowupCount}/${maxFollowups}) AND question answered
- [STATUS:CONTINUE] = Still have follow-ups remaining OR answer incomplete

REMEMBER: You are ONLY evaluating "${actualQuestionTitle}" with exactly ${maxFollowups} follow-ups!`;

        const messages: ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: userTranscript }
        ];

        const llmStart = Date.now();
        const completion = await groq.chat.completions.create({
            messages,
            model: 'llama-3.3-70b-versatile',
            temperature: 0.6,
            max_tokens: 150,
        });
        const llmTime = Date.now() - llmStart;
        console.log(`⏱️ LLM: ${llmTime}ms`);

        const aiReply = completion.choices[0]?.message?.content || "I didn't catch that.";
        console.log('AI replied:', aiReply);

        // FIX: Parse status tag with OPTIONAL space (handles both [STATUS:COMPLETE] and [STATUS: COMPLETE])
        const statusMatch = aiReply.match(/\[STATUS:\s*(COMPLETE|CONTINUE)\]/);
        const aiStatus = statusMatch ? statusMatch[1] : 'CONTINUE';

        // Remove status tag from user-visible reply
        const cleanReply = aiReply.replace(/\[STATUS:\s*(COMPLETE|CONTINUE)\]/, '').trim();

        console.log('AI Status:', aiStatus);

        // INCREMENT FOLLOW-UP COUNT when AI continues discussion
        if (aiStatus === 'CONTINUE' && dbQuestion) {
            const newFollowupCount = currentFollowupCount + 1;
            await supabase
                .from('interview_questions')
                .update({ followup_count: newFollowupCount })
                .eq('session_id', sessionId)
                .eq('status', 'active');

            console.log(`Follow-up count: ${newFollowupCount}/${maxFollowups}`);
        }

        //fetch next question from DB
        let newQuestion: Question | null = null;

        // Check if user explicitly requested next question
        const lowerTranscript = userTranscript.toLowerCase();
        const userRequestedNext = NEXT_QUESTION_TRIGGERS.some(trigger =>
            lowerTranscript.includes(trigger)
        );

        const shouldAdvance = (userRequestedNext || aiStatus === 'COMPLETE') && !isFinalQuestion && !hasReachedLimit;

        if (shouldAdvance) {
            console.log('Advancing to next question...');

            // Mark current question as completed in DB
            const { data: currentQ } = await supabase
                .from('interview_questions')
                .select('id')
                .eq('session_id', sessionId)
                .eq('status', 'active')
                .single();

            if (currentQ) {
                await supabase
                    .from('interview_questions')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                        user_answer: conversationHistory.map((m: Message) => m.content).join('\n')
                    })
                    .eq('id', currentQ.id);
            }

            // Fetch next pending question from DB
            const { data: nextQ, error: nextError } = await supabase
                .from('interview_questions')
                .select('*')
                .eq('session_id', sessionId)
                .eq('status', 'pending')
                .order('question_order', { ascending: true })
                .limit(1)
                .single();

            if (nextQ && !nextError) {
                // Activate next question
                await supabase
                    .from('interview_questions')
                    .update({
                        status: 'active',
                        asked_at: new Date().toISOString()
                    })
                    .eq('id', nextQ.id);

                // Map to frontend format
                newQuestion = {
                    title: nextQ.question_title,
                    description: nextQ.question_description,
                    difficulty: nextQ.question_difficulty,
                    constraints: nextQ.constraints || [],
                    examples: (nextQ.examples as unknown as Example[]) || []
                };

                console.log('✅ Next question activated:', newQuestion!.title);

                // CRITICAL FIX: Generate intro for the NEW question
                try {
                    const introRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/generate-intro`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            question: newQuestion,
                            interviewType: session.interview_type,
                            isFirstQuestion: false // Tell API this is NOT first question
                        })
                    });

                    if (introRes.ok) {
                        // FIX: Field names are introText and audioBase64, NOT intro and audio!
                        const { introText, audioBase64 } = await introRes.json();
                        console.log(`Generated intro for new question`);

                        // Early return with new question intro
                        return NextResponse.json({
                            reply: introText,  // Use 'reply' to match frontend expectation
                            audioBase64,       // Use correct field name
                            newQuestion,
                            shouldEndInterview: false
                        });
                    }
                } catch (err) {
                    console.error('Failed to generate intro:', err);
                }
            } else {
                console.log('No more questions in database');
            }

        } else if (isFinalQuestion && (userRequestedNext || aiStatus === 'COMPLETE')) {
            //User finished final question - mark as completed
            console.log('Final question complete. Marking as completed...');

            const { data: finalQ } = await supabase
                .from('interview_questions')
                .select('id')
                .eq('session_id', sessionId)
                .eq('status', 'active')
                .single();

            if (finalQ) {
                await supabase
                    .from('interview_questions')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                        user_answer: conversationHistory.map((m: Message) => m.content).join('\n')
                    })
                    .eq('id', finalQ.id);
            }

            console.log('Signaling interview end.');
        }

        //TTS: Murf AI(Falcon Model) GOAT!
        const ttsStart = Date.now();
        const murfUrl = 'https://global.api.murf.ai/v1/speech/stream';

        // Get voice from session or default to US
        const voiceId = session.voice_id || 'en-US-matthew';
        // Extract locale from voice ID (e.g., 'en-US-matthew' -> 'en-US')
        const locale = voiceId.split('-').slice(0, 2).join('-');

        const murfPayload = {
            voiceId: voiceId,
            text: cleanReply,
            multiNativeLocale: locale,
            model: 'FALCON',
            format: 'MP3',
            sampleRate: 24000,
            channelType: 'MONO'
        };

        const murfResponse = await fetch(murfUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': MURF_API_KEY!
            },
            body: JSON.stringify(murfPayload)
        });

        if (!murfResponse.ok) {
            const errText = await murfResponse.text();
            console.error('Murf Falcon Error:', errText);
            throw new Error(`Murf TTS failed: ${errText}`);
        }

        const audioArrayBuffer = await murfResponse.arrayBuffer();
        const audioBase64 = Buffer.from(audioArrayBuffer).toString('base64');
        const ttsTime = Date.now() - ttsStart;
        console.log(`⏱️ TTS: ${ttsTime}ms`);

        const totalTime = Date.now() - totalStart;
        console.log(`⏱️ TOTAL TURN: ${totalTime}ms (STT: ${sttTime}ms, LLM: ${llmTime}ms, TTS: ${ttsTime}ms)`);

        // Update session in database with new messages
        const updatedMessages = [
            ...conversationHistory,
            { role: 'user', content: userTranscript },
            { role: 'assistant', content: cleanReply }
        ];

        await supabase
            .from('interview_sessions')
            .update({
                messages: updatedMessages,
                current_question_index: newQuestion ? currentQuestionIndex + 1 : currentQuestionIndex
            })
            .eq('id', sessionId)
            .eq('user_id', user.id);

        return NextResponse.json({
            transcript: userTranscript,
            reply: cleanReply,
            audioBase64: audioBase64,
            newQuestion: newQuestion,
            shouldEndInterview: isFinalQuestion && (userRequestedNext || aiStatus === 'COMPLETE')
        });

    } catch (error) {
        console.error('Processing Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}