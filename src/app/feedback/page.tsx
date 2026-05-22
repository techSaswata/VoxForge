'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trophy, Target, Clock, TrendingUp, ChevronRight, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface FeedbackReport {
    id: string;
    session_id: string;
    overall_score: number;
    overall_verdict: string;
    summary: string;
    created_at: string;
    interview_type?: string;
    difficulty?: string;
}

type FeedbackReportWithSession = FeedbackReport & {
    interview_sessions?: {
        interview_type?: string;
        difficulty?: string;
    };
};

export default function FeedbackListPage() {
    const router = useRouter();
    const supabase = createClient();

    const [feedbackList, setFeedbackList] = useState<FeedbackReport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFeedback();
    }, []);

    const loadFeedback = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            // Fetch all feedback reports with session info
            const { data: feedbackData, error } = await supabase
                .from('feedback_reports')
                .select(`
                    *,
                    interview_sessions!session_id (interview_type, difficulty)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching feedback:', error);
            } else {
                // Map to flatten the joined data
                const mapped = ((feedbackData || []) as FeedbackReportWithSession[]).map((fb) => ({
                    ...fb,
                    interview_type: fb.interview_sessions?.interview_type || 'Unknown',
                    difficulty: fb.interview_sessions?.difficulty || 'Unknown'
                }));
                setFeedbackList(mapped);
            }
        } catch (error) {
            console.error('Error loading feedback:', error);
        } finally {
            setLoading(false);
        }
    };

    const getVerdictColor = (verdict: string) => {
        if (!verdict) return 'text-gray-400';
        if (verdict.includes('Strong Hire') || verdict === 'Hire') return 'text-green-400';
        if (verdict.includes('Lean Hire')) return 'text-blue-400';
        if (verdict.includes('Lean No')) return 'text-cyan-400';
        return 'text-red-400';
    };

    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-green-400 border-green-400';
        if (score >= 6) return 'text-yellow-400 border-yellow-400';
        return 'text-red-400 border-red-400';
    };

    const formatType = (type: string) => {
        const typeMap: Record<string, string> = {
            dsa: 'DSA',
            DSA: 'DSA',
            frontend: 'Frontend',
            Frontend: 'Frontend',
            backend: 'Backend',
            Backend: 'Backend',
            fullstack: 'Fullstack',
            Fullstack: 'Fullstack',
            cybersecurity: 'Cybersecurity',
            Cybersecurity: 'Cybersecurity',
            devops: 'DevOps',
            DevOps: 'DevOps'
        };
        return typeMap[type] || type || 'Interview';
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0b] text-white">
            {/* Animated Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Header */}
            <nav className="relative z-10 border-b border-white/10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/dashboard" className="flex items-center gap-2 text-[#6b6b70] hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back to Dashboard</span>
                    </Link>
                    <h1 className="text-xl font-bold">Feedback History</h1>
                    <div className="w-32"></div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 max-w-6xl mx-auto px-6 py-8">
                {/* Stats Summary */}
                {feedbackList.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                    <Trophy className="w-5 h-5 text-cyan-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{feedbackList.length}</p>
                                    <p className="text-xs text-[#6b6b70]">Total Interviews</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                    <Target className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">
                                        {(feedbackList.reduce((acc, fb) => acc + (fb.overall_score || 0), 0) / feedbackList.length).toFixed(1)}
                                    </p>
                                    <p className="text-xs text-[#6b6b70]">Average Score</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">
                                        {feedbackList.filter(fb => fb.overall_verdict?.includes('Hire') && !fb.overall_verdict?.includes('No')).length}
                                    </p>
                                    <p className="text-xs text-[#6b6b70]">Hire Decisions</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Feedback Cards */}
                {feedbackList.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                            <Trophy className="w-10 h-10 text-[#6b6b70]" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">No Feedback Yet</h2>
                        <p className="text-[#6b6b70] mb-6">Complete an interview to receive detailed feedback!</p>
                        <Link
                            href="/setup"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 rounded-lg font-medium transition-colors"
                        >
                            Start Interview
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-[#a0a0a5]">
                            {feedbackList.length} Interview{feedbackList.length > 1 ? 's' : ''}
                        </h2>

                        <div className="grid gap-4">
                            {feedbackList.map((fb) => (
                                <Link
                                    key={fb.id}
                                    href={`/feedback/${fb.session_id}`}
                                    className="group block p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-cyan-500/50 hover:bg-white/10 transition-all"
                                >
                                    <div className="flex items-start gap-6">
                                        {/* Score Circle */}
                                        <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${getScoreColor(fb.overall_score || 0)}`}>
                                            <span className="text-2xl font-bold">{fb.overall_score || 0}</span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-400">
                                                    {formatType(fb.interview_type || '')}
                                                </span>
                                                <span className="text-xs px-2 py-1 rounded bg-white/10 text-[#a0a0a5]">
                                                    {fb.difficulty}
                                                </span>
                                                <span className={`text-sm font-medium ${getVerdictColor(fb.overall_verdict || '')}`}>
                                                    {fb.overall_verdict || 'Pending'}
                                                </span>
                                            </div>

                                            <p className="text-sm text-[#b8b8bc] line-clamp-2 mb-3">
                                                {fb.summary || 'No summary available'}
                                            </p>

                                            <div className="flex items-center gap-4 text-xs text-[#6b6b70]">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatDate(fb.created_at)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Arrow */}
                                        <div className="flex items-center self-center">
                                            <ChevronRight className="w-5 h-5 text-[#6b6b70] group-hover:text-cyan-400 transition-colors" />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
