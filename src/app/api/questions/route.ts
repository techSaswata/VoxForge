import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Fetch questions for a session
export async function GET(req: Request) {
    try {
        const supabase = await createClient();

        // Authenticate
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('sessionId');
        const status = searchParams.get('status') as 'active' | 'pending' | 'completed' | null; // 'active', 'pending', 'completed', or null for all

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }

        // Verify user owns this session
        const { data: session, error: sessionError } = await supabase
            .from('interview_sessions')
            .select('id')
            .eq('id', sessionId)
            .eq('user_id', user.id)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Build query
        let query = supabase
            .from('interview_questions')
            .select('*')
            .eq('session_id', sessionId)
            .order('question_order', { ascending: true });

        // Filter by status if provided
        if (status) {
            query = query.eq('status', status);
        }

        const { data: questions, error: questionsError } = status === 'active'
            ? await query.single() // Get single active question
            : await query; // Get all questions

        if (questionsError) {
            // If no active question found, it might be end of interview
            if (status === 'active' && questionsError.code === 'PGRST116') {
                return NextResponse.json({ question: null, message: 'No active question' });
            }
            console.error('Error fetching questions:', questionsError);
            return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
        }

        // Return based on whether we're fetching single or multiple
        if (status === 'active') {
            return NextResponse.json({ question: questions });
        } else {
            return NextResponse.json({ questions });
        }

    } catch (error) {
        console.error('Questions fetch error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
