import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Auto-complete interviews that have been active for more than 1 hour
export async function POST(_req: Request) {
    try {
        const supabase = await createClient();

        // Get all active sessions that are older than 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { data: oldSessions, error } = await supabase
            .from('interview_sessions')
            .select('id')
            .eq('status', 'active')
            .lt('created_at', oneHourAgo); // Use created_at since started_at may be NULL

        if (error) {
            console.error('Error fetching old sessions:', error);
            return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
        }

        if (!oldSessions || oldSessions.length === 0) {
            return NextResponse.json({
                message: 'No sessions to cleanup',
                count: 0
            });
        }

        // Mark all these sessions as abandoned
        const sessionIds = oldSessions.map(s => s.id);

        const { error: updateError } = await supabase
            .from('interview_sessions')
            .update({
                status: 'abandoned',
                completed_at: new Date().toISOString()
            })
            .in('id', sessionIds);

        if (updateError) {
            console.error('Error updating sessions:', updateError);
            return NextResponse.json({ error: 'Failed to update sessions' }, { status: 500 });
        }

        console.log(`✅ Auto-completed ${sessionIds.length} abandoned interview(s)`);

        return NextResponse.json({
            message: 'Sessions cleaned up successfully',
            count: sessionIds.length
        });

    } catch (error) {
        console.error('Cleanup error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
