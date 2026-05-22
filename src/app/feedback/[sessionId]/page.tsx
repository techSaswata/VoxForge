'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, Target, MessageSquare, Lightbulb, TrendingUp, CheckCircle, AlertCircle, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface FeedbackData {
    overallScore: number;
    overallVerdict: string;
    summary: string;
    strengths: string[];
    areasForImprovement: string[];
    technicalSkills: { score: number; feedback: string };
    problemSolving: { score: number; feedback: string };
    communication: { score: number; feedback: string };
    recommendations: string[];
}

interface SessionData {
    interview_type: string;
    difficulty: string;
    created_at: string;
}

function ScoreCircle({ score, label }: { score: number; label: string }) {
    const getColor = (s: number) => {
        if (s >= 8) return 'text-green-400 border-green-400';
        if (s >= 6) return 'text-yellow-400 border-yellow-400';
        return 'text-red-400 border-red-400';
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${getColor(score)}`}>
                <span className="text-2xl font-bold">{score}</span>
            </div>
            <span className="text-sm text-[#b8b8bc]">{label}</span>
        </div>
    );
}

interface PageProps {
    params: Promise<{ sessionId: string }>;
}

export default function FeedbackPage({ params }: PageProps) {
    const { sessionId } = use(params);
    const router = useRouter();

    const [feedback, setFeedback] = useState<FeedbackData | null>(null);
    const [session, setSession] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Fetch feedback from DB on mount
    useEffect(() => {
        const fetchFeedback = async () => {
            try {
                const response = await fetch(`/api/sessions/${sessionId}/feedback`);

                if (!response.ok) {
                    if (response.status === 404) {
                        setError('Feedback not found for this session');
                    } else {
                        setError('Failed to load feedback');
                    }
                    return;
                }

                const data = await response.json();
                setFeedback(data.feedback);
                setSession(data.session);
            } catch (err) {
                console.error('Error fetching feedback:', err);
                setError('Failed to load feedback');
            } finally {
                setLoading(false);
            }
        };

        fetchFeedback();
    }, [sessionId]);

    const getVerdictColor = (verdict: string | undefined | null) => {
        if (!verdict) return 'text-[#6b6b70] bg-[#2a2a2e]';
        if (verdict.includes('Strong Hire') || verdict.includes('Hire')) return 'text-green-400 bg-green-500/20';
        if (verdict.includes('Lean')) return 'text-yellow-400 bg-yellow-500/20';
        return 'text-red-400 bg-red-500/20';
    };

    const exportToPDF = async () => {
        if (!feedback) return;
        setIsExporting(true);

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Interview Feedback Report - ${sessionId}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        padding: 40px;
                        max-width: 800px;
                        margin: 0 auto;
                        color: #1a1a1a;
                        line-height: 1.6;
                    }
                    .header { 
                        text-align: center; 
                        margin-bottom: 40px;
                        padding-bottom: 20px;
                        border-bottom: 2px solid #e5e5e5;
                    }
                    .logo { font-size: 24px; font-weight: bold; color: #f97316; margin-bottom: 8px; }
                    .uid { color: #666; font-size: 12px; }
                    .score-section {
                        display: flex;
                        align-items: center;
                        gap: 30px;
                        margin-bottom: 40px;
                        padding: 30px;
                        background: #f8f8f8;
                        border-radius: 12px;
                    }
                    .main-score {
                        width: 100px;
                        height: 100px;
                        border-radius: 50%;
                        border: 4px solid ${feedback.overallScore >= 8 ? '#22c55e' : feedback.overallScore >= 6 ? '#eab308' : '#ef4444'};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 36px;
                        font-weight: bold;
                        color: ${feedback.overallScore >= 8 ? '#22c55e' : feedback.overallScore >= 6 ? '#eab308' : '#ef4444'};
                        flex-shrink: 0;
                    }
                    .verdict {
                        display: inline-block;
                        padding: 6px 16px;
                        border-radius: 20px;
                        font-size: 14px;
                        font-weight: 500;
                        margin-bottom: 10px;
                        background: ${feedback.overallVerdict.includes('Hire') ? '#dcfce7' : feedback.overallVerdict.includes('Lean') ? '#fef9c3' : '#fee2e2'};
                        color: ${feedback.overallVerdict.includes('Hire') ? '#166534' : feedback.overallVerdict.includes('Lean') ? '#854d0e' : '#dc2626'};
                    }
                    .summary { color: #444; font-size: 14px; }
                    h2 { font-size: 18px; margin: 30px 0 15px; color: #1a1a1a; }
                    .scores-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
                    .score-card { padding: 20px; background: #f8f8f8; border-radius: 8px; text-align: center; }
                    .score-card h3 { font-size: 14px; margin-bottom: 10px; color: #666; }
                    .score-card .score { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
                    .score-card p { font-size: 12px; color: #666; }
                    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .list-section { padding: 20px; background: #f8f8f8; border-radius: 8px; }
                    .list-section h3 { font-size: 16px; margin-bottom: 12px; }
                    .list-section ul { list-style: none; }
                    .list-section li { padding: 8px 0; font-size: 13px; border-bottom: 1px solid #e5e5e5; }
                    .list-section li:last-child { border-bottom: none; }
                    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #999; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">🎤 VoxForge AI</div>
                    <div>Interview Feedback Report</div>
                    <div class="uid">Session: ${sessionId} | Generated: ${new Date().toLocaleDateString()}</div>
                </div>

                <div class="score-section">
                    <div class="main-score">${feedback.overallScore}</div>
                    <div>
                        <div class="verdict">${feedback.overallVerdict}</div>
                        <p class="summary">${feedback.summary}</p>
                    </div>
                </div>

                <h2>Score Breakdown</h2>
                <div class="scores-grid">
                    <div class="score-card">
                        <h3>Technical Skills</h3>
                        <div class="score" style="color: ${feedback.technicalSkills.score >= 8 ? '#22c55e' : feedback.technicalSkills.score >= 6 ? '#eab308' : '#ef4444'}">${feedback.technicalSkills.score}/10</div>
                        <p>${feedback.technicalSkills.feedback}</p>
                    </div>
                    <div class="score-card">
                        <h3>Problem Solving</h3>
                        <div class="score" style="color: ${feedback.problemSolving.score >= 8 ? '#22c55e' : feedback.problemSolving.score >= 6 ? '#eab308' : '#ef4444'}">${feedback.problemSolving.score}/10</div>
                        <p>${feedback.problemSolving.feedback}</p>
                    </div>
                    <div class="score-card">
                        <h3>Communication</h3>
                        <div class="score" style="color: ${feedback.communication.score >= 8 ? '#22c55e' : feedback.communication.score >= 6 ? '#eab308' : '#ef4444'}">${feedback.communication.score}/10</div>
                        <p>${feedback.communication.feedback}</p>
                    </div>
                </div>

                <div class="two-col">
                    <div class="list-section">
                        <h3>✅ Strengths</h3>
                        <ul>${feedback.strengths.map(s => `<li>• ${s}</li>`).join('')}</ul>
                    </div>
                    <div class="list-section">
                        <h3>⚠️ Areas for Improvement</h3>
                        <ul>${feedback.areasForImprovement.map(a => `<li>• ${a}</li>`).join('')}</ul>
                    </div>
                </div>

                <div class="list-section" style="background: #fff7ed; border: 1px solid #fed7aa;">
                    <h3 style="color: #f97316;">📈 Recommendations</h3>
                    <ul>${feedback.recommendations.map((r, i) => `<li>${i + 1}. ${r}</li>`).join('')}</ul>
                </div>

                <div class="footer">Generated by VoxForge AI • Practice makes perfect! 🚀</div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.onload = () => {
                printWindow.print();
                setIsExporting(false);
            };
            setTimeout(() => setIsExporting(false), 2000);
        } else {
            alert('Please allow popups to download PDF');
            setIsExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error || !feedback) {
        return (
            <div className="min-h-screen bg-[#0d0d0f] flex flex-col items-center justify-center text-white">
                <p className="text-xl mb-4">{error || 'No feedback data found'}</p>
                <Link href="/dashboard" className="text-cyan-500 hover:text-cyan-400">
                    ← Return to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0d0d0f] text-white">
            {/* Header */}
            <div className="border-b border-[#2a2a2e] px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <Link href="/dashboard" className="flex items-center gap-2 text-[#6b6b70] hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span>Return to Dashboard</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={exportToPDF}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1e] hover:bg-[#2a2a2e] border border-[#3a3a3e] rounded-lg text-sm transition-colors disabled:opacity-50"
                        >
                            {isExporting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            Export PDF
                        </button>
                        {session && (
                            <div className="text-xs text-[#6b6b70]">
                                {session.interview_type} • {session.difficulty}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div ref={contentRef} className="max-w-5xl mx-auto px-6 py-8">
                {/* Overall Score Card */}
                <div className="bg-gradient-to-br from-[#1a1a1e] to-[#141416] rounded-2xl p-8 mb-8 border border-[#2a2a2e]">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="flex flex-col items-center">
                            <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center ${(feedback.overallScore ?? 0) >= 8 ? 'border-green-400 text-green-400' :
                                (feedback.overallScore ?? 0) >= 6 ? 'border-yellow-400 text-yellow-400' :
                                    'border-red-400 text-red-400'
                                }`}>
                                <span className="text-5xl font-bold">{feedback.overallScore ?? 0}</span>
                            </div>
                            <span className="text-sm text-[#6b6b70] mt-2">out of 10</span>
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium ${getVerdictColor(feedback.overallVerdict)}`}>
                                {feedback.overallVerdict || 'Pending Review'}
                            </span>
                            <h1 className="text-2xl font-bold mt-4 mb-2">Interview Feedback</h1>
                            <p className="text-[#b8b8bc] leading-relaxed">{feedback.summary || 'No summary available'}</p>
                        </div>
                    </div>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-[#1a1a1e] rounded-xl p-6 border border-[#2a2a2e]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <Target className="w-5 h-5 text-blue-400" />
                            </div>
                            <h3 className="font-semibold">Technical Skills</h3>
                        </div>
                        <ScoreCircle score={feedback.technicalSkills?.score ?? 0} label="Score" />
                        <p className="text-sm text-[#b8b8bc] mt-4 leading-relaxed">{feedback.technicalSkills?.feedback || 'No feedback available'}</p>
                    </div>

                    <div className="bg-[#1a1a1e] rounded-xl p-6 border border-[#2a2a2e]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Lightbulb className="w-5 h-5 text-purple-400" />
                            </div>
                            <h3 className="font-semibold">Problem Solving</h3>
                        </div>
                        <ScoreCircle score={feedback.problemSolving?.score ?? 0} label="Score" />
                        <p className="text-sm text-[#b8b8bc] mt-4 leading-relaxed">{feedback.problemSolving?.feedback || 'No feedback available'}</p>
                    </div>

                    <div className="bg-[#1a1a1e] rounded-xl p-6 border border-[#2a2a2e]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 text-green-400" />
                            </div>
                            <h3 className="font-semibold">Communication</h3>
                        </div>
                        <ScoreCircle score={feedback.communication?.score ?? 0} label="Score" />
                        <p className="text-sm text-[#b8b8bc] mt-4 leading-relaxed">{feedback.communication?.feedback || 'No feedback available'}</p>
                    </div>
                </div>

                {/* Strengths & Improvements */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-[#1a1a1e] rounded-xl p-6 border border-[#2a2a2e]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                            </div>
                            <h3 className="font-semibold">Strengths</h3>
                        </div>
                        <ul className="space-y-3">
                            {(feedback.strengths ?? []).map((strength, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 flex-shrink-0"></span>
                                    <span className="text-sm text-[#b8b8bc]">{strength}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-[#1a1a1e] rounded-xl p-6 border border-[#2a2a2e]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-yellow-400" />
                            </div>
                            <h3 className="font-semibold">Areas for Improvement</h3>
                        </div>
                        <ul className="space-y-3">
                            {(feedback.areasForImprovement ?? []).map((area, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 flex-shrink-0"></span>
                                    <span className="text-sm text-[#b8b8bc]">{area}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Recommendations */}
                <div className="bg-gradient-to-br from-cyan-500/10 to-[#1a1a1e] rounded-xl p-6 border border-cyan-500/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-cyan-400" />
                        </div>
                        <h3 className="font-semibold">Recommendations for Improvement</h3>
                    </div>
                    <ul className="space-y-3">
                        {(feedback.recommendations ?? []).map((rec, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs text-cyan-400 flex-shrink-0">
                                    {i + 1}
                                </span>
                                <span className="text-sm text-[#b8b8bc]">{rec}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Footer */}
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                        onClick={exportToPDF}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-6 py-3 border border-[#3a3a3e] hover:border-cyan-500 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {isExporting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Download className="w-5 h-5" />
                        )}
                        Download Report
                    </button>
                    <Link
                        href="/setup"
                        className="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 rounded-lg font-medium transition-colors"
                    >
                        <Trophy className="w-5 h-5" />
                        Start New Interview
                    </Link>
                </div>
            </div>
        </div>
    );
}
