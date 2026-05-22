import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
    params: Promise<{ sessionId: string }>;
}

// GET /api/sessions/[sessionId]/feedback - Fetch feedback for session
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { sessionId } = await params;
        const supabase = await createClient();

        // Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch feedback from DB
        const { data: feedback, error } = await supabase
            .from('feedback_reports')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (error || !feedback) {
            return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
        }

        // Also fetch session details for context
        const { data: session } = await supabase
            .from('interview_sessions')
            .select('interview_type, difficulty, question_count, created_at')
            .eq('id', sessionId)
            .single();

        // Map database columns to frontend format
        // Database columns: overall_score, overall_verdict, summary, strengths, areas_for_improvement
        // technical_skills_score, technical_skills_feedback, problem_solving_score, etc.
        return NextResponse.json({
            feedback: {
                overallScore: feedback.overall_score ?? 0,
                overallVerdict: feedback.overall_verdict ?? 'Pending',
                summary: feedback.summary ?? 'No summary available',
                strengths: feedback.strengths ?? [],
                areasForImprovement: feedback.areas_for_improvement ?? [],
                technicalSkills: {
                    score: feedback.technical_skills_score ?? 0,
                    feedback: feedback.technical_skills_feedback ?? ''
                },
                problemSolving: {
                    score: feedback.problem_solving_score ?? 0,
                    feedback: feedback.problem_solving_feedback ?? ''
                },
                communication: {
                    score: feedback.communication_score ?? 0,
                    feedback: feedback.communication_feedback ?? ''
                },
                recommendations: feedback.recommendations ?? []
            },
            session: session || null,
            createdAt: feedback.created_at
        });
    } catch (error) {
        console.error('Error fetching feedback:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
