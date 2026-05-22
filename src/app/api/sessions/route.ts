import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Database, Json } from '@/lib/supabase/database.types';

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type QuestionInsert = Database['public']['Tables']['interview_questions']['Insert'];
type SessionInsert = Database['public']['Tables']['interview_sessions']['Insert'];
type SessionUpdate = Database['public']['Tables']['interview_sessions']['Update'];
type InterviewType = SessionInsert['interview_type'];

interface SessionCreateBody {
    interview_type: InterviewType;
    difficulty: Difficulty;
    topics: string[];
    num_questions: number;
    voice_id?: string;
}

interface GeneratedQuestion {
    title: string;
    description: string;
    difficulty: Difficulty;
    type?: string;
    constraints?: string[];
    examples?: Json;
    followup_guidelines?: string[];
}

// Create a new interview session
export async function POST(req: Request) {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = (await req.json()) as SessionCreateBody;
        const { interview_type, difficulty, topics, num_questions, voice_id } = body;

        // Validate input
        if (!interview_type || !difficulty || !topics || !num_questions) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const sessionInsert: SessionInsert = {
            user_id: user.id,
            interview_type,
            difficulty,
            topics,
            num_questions,
            voice_id: voice_id || 'en-US-matthew', // Default to US accent
            status: 'active',
            messages: [],
            current_question_index: 0,
        };

        // Create new session
        const { data: session, error } = await supabase
            .from('interview_sessions')
            .insert(sessionInsert)
            .select()
            .single();

        if (error) {
            console.error('Error creating session:', error);
            return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
        }

        console.log(`Session created: ${session.id}. Generating ${num_questions} questions...`);

        // ==================================================================
        // PLANNED ARCHITECTURE: Generate ALL questions upfront
        // ==================================================================

        try {
            // Call batch generation API
            const questionResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/generate-question-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': req.headers.get('cookie') || '', // Pass auth cookies
                },
                body: JSON.stringify({
                    interviewType: interview_type,
                    difficulty,
                    topics,
                    count: num_questions
                })
            });

            if (!questionResponse.ok) {
                throw new Error('Failed to generate questions');
            }

            const { questions } = (await questionResponse.json()) as { questions: GeneratedQuestion[] };

            console.log(`Generated ${questions.length} questions:`);
            questions.forEach((q, i) => console.log(`  ${i + 1}. ${q.title}`));

            // Store each question in interview_questions table
            const questionInserts: QuestionInsert[] = questions.map((q, index) => ({
                session_id: session.id,
                user_id: user.id,
                question_title: q.title,
                question_description: q.description,
                question_difficulty: q.difficulty,
                question_type: q.type || interview_type,
                constraints: q.constraints,
                examples: q.examples,
                followup_guidelines: q.followup_guidelines,
                question_order: index + 1,
                status: index === 0 ? 'active' : 'pending', // First question is active
            }));

            const { data: insertedQuestions, error: insertError } = await supabase
                .from('interview_questions')
                .insert(questionInserts)
                .select();

            if (insertError) {
                console.error('❌ Error inserting questions:', insertError);
            } else {
                console.log(`✅ Successfully stored ${insertedQuestions?.length || 0} questions for session ${session.id}`);

                // Verify by counting
                const { count } = await supabase
                    .from('interview_questions')
                    .select('*', { count: 'exact', head: true })
                    .eq('session_id', session.id);
                console.log(`✅ Verification: ${count} questions in DB for this session`);
            }

        } catch (questionError) {
            console.error('Question generation error:', questionError);
            // Don't fail the session creation - just log the error
            // Questions can be generated on-the-fly as fallback
        }

        return NextResponse.json({ session });
    } catch (error) {
        console.error('Session creation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Get session by ID
export async function GET(req: Request) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('id');

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }

        const { data: session, error } = await supabase
            .from('interview_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('user_id', user.id)
            .single();

        if (error) {
            console.error('Error fetching session:', error);
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        return NextResponse.json({ session });
    } catch (error) {
        console.error('Session fetch error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Update session (messages, status, etc.)
export async function PATCH(req: Request) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { sessionId, messages, status, currentQuestionIndex } = body;

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }

        const updateData: SessionUpdate = {};
        if (messages !== undefined) updateData.messages = messages as Json;
        if (status !== undefined) updateData.status = status;
        if (currentQuestionIndex !== undefined) updateData.current_question_index = currentQuestionIndex;

        const { data: session, error } = await supabase
            .from('interview_sessions')
            .update(updateData)
            .eq('id', sessionId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating session:', error);
            return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
        }

        return NextResponse.json({ session });
    } catch (error) {
        console.error('Session update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
