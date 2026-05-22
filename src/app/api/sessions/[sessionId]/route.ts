import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
    params: Promise<{ sessionId: string }>;
}

// GET /api/sessions/[sessionId] - Fetch session details with status validation
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { sessionId } = await params;
        const supabase = await createClient();

        // Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch session from DB
        const { data: session, error } = await supabase
            .from('interview_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('user_id', user.id) // Ensure user owns this session
            .single();

        if (error || !session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // SECURITY: Check if session is still active
        // If completed or abandoned, return error so frontend redirects
        if (session.status === 'completed') {
            return NextResponse.json({
                error: 'Interview already completed',
                redirectTo: `/feedback/${sessionId}`,
                status: 'completed'
            }, { status: 403 });
        }

        if (session.status === 'abandoned') {
            return NextResponse.json({
                error: 'Interview was abandoned',
                redirectTo: '/dashboard',
                status: 'abandoned'
            }, { status: 403 });
        }

        // Session is active - allow access
        return NextResponse.json({
            session,
            status: session.status // active
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/sessions/[sessionId] - Update session status
export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const { sessionId } = await params;
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { status } = body;

        // Only allow specific status transitions
        if (!['active', 'completed', 'abandoned'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const { data: session, error } = await supabase
            .from('interview_sessions')
            .update({
                status,
                completed_at: status !== 'active' ? new Date().toISOString() : null
            })
            .eq('id', sessionId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error || !session) {
            return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
        }

        return NextResponse.json({ session });
    } catch (error) {
        console.error('Error updating session:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
