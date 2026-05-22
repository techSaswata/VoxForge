'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, MessageSquare, ShieldCheck, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';

interface PageProps {
    params: Promise<{ sessionId: string }>;
}

export default function InterviewInstructionsPage({ params }: PageProps) {
    const { sessionId } = use(params);
    const router = useRouter();
    const [accepted, setAccepted] = useState(false);

    const handleStartInterview = () => {
        if (accepted) {
            router.push(`/interview/${sessionId}`);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0b] text-white">
            {/* Animated Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Header */}
            <nav className="relative z-10 border-b border-white/10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/setup" className="flex items-center gap-2 text-[#6b6b70] hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back to Setup</span>
                    </Link>
                    <h1 className="text-xl font-bold">Interview Instructions</h1>
                    <div className="w-32"></div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 max-w-3xl mx-auto px-6 py-12">
                {/* Title Section */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center">
                        <ShieldCheck className="w-8 h-8 text-cyan-400" />
                    </div>
                    <h2 className="text-3xl font-bold mb-2">Before You Begin</h2>
                    <p className="text-[#a0a0a5]">Please read these instructions carefully</p>
                </div>

                {/* Instructions Cards */}
                <div className="space-y-4 mb-8">
                    {/* Time Limit */}
                    <div className="p-5 bg-white/5 border border-white/10 rounded-xl flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <Clock className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold mb-1">60 Minutes Time Limit</h3>
                            <p className="text-sm text-[#a0a0a5]">
                                This interview session has a maximum duration of 60 minutes.
                                The session will automatically end after this time.
                            </p>
                        </div>
                    </div>

                    {/* AI Interaction */}
                    <div className="p-5 bg-white/5 border border-white/10 rounded-xl flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold mb-1">Interactive VoxForge Interviewer</h3>
                            <p className="text-sm text-[#a0a0a5]">
                                The AI will ask you technical questions and follow-ups.
                                Feel free to <span className="text-green-400">ask clarifying questions</span>,
                                think aloud, and explain your approach. The AI is here to help you demonstrate your skills.
                            </p>
                        </div>
                    </div>

                    {/* Navigation Warning */}
                    <div className="p-5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold mb-1 text-cyan-300">Important Session Rules</h3>
                            <ul className="text-sm text-[#a0a0a5] space-y-2 mt-2">
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
                                    <span>Do <strong className="text-cyan-300">NOT</strong> navigate away, go back, or forward during the interview</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
                                    <span>Do <strong className="text-cyan-300">NOT</strong> refresh or close the browser tab</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
                                    <span>Do <strong className="text-cyan-300">NOT</strong> open the interview in another tab or window</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
                                    <span>Use the <strong className="text-cyan-300">&quot;End Interview&quot;</strong> button when you&apos;re finished</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="p-5 bg-white/5 border border-white/10 rounded-xl flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold mb-1">Tips for Success</h3>
                            <ul className="text-sm text-[#a0a0a5] space-y-1 mt-2">
                                <li>• Think out loud and explain your reasoning</li>
                                <li>• Ask questions if something is unclear</li>
                                <li>• It&apos;s okay to take your time</li>
                                <li>• Focus on your approach, not just the final answer</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Motivational Message */}
                <div className="p-6 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-2xl text-center mb-8">
                    <p className="text-lg font-medium text-white mb-1">
                        ✨ You&apos;ve got this!
                    </p>
                    <p className="text-[#a0a0a5]">
                        Take a deep breath, believe in yourself, and show us what you can do.
                        Every great developer was once where you are. Good luck! 🚀
                    </p>
                </div>

                {/* Accept Checkbox */}
                <div className="mb-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={accepted}
                                onChange={(e) => setAccepted(e.target.checked)}
                                className="peer sr-only"
                            />
                            <div className={`w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center ${accepted
                                    ? 'bg-cyan-500 border-cyan-500'
                                    : 'border-white/30 group-hover:border-white/50'
                                }`}>
                                {accepted && <CheckCircle2 className="w-4 h-4 text-white" />}
                            </div>
                        </div>
                        <span className="text-sm text-[#a0a0a5] group-hover:text-white transition-colors">
                            I have read and understood all the instructions above
                        </span>
                    </label>
                </div>

                {/* Start Button */}
                <button
                    onClick={handleStartInterview}
                    disabled={!accepted}
                    className={`w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${accepted
                            ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40'
                            : 'bg-white/10 text-white/40 cursor-not-allowed'
                        }`}
                >
                    {accepted ? (
                        <>
                            <Sparkles className="w-5 h-5" />
                            Start Interview
                        </>
                    ) : (
                        'Please accept the instructions to continue'
                    )}
                </button>

                {/* Cancel Link */}
                <div className="text-center mt-4">
                    <Link
                        href="/dashboard"
                        className="text-sm text-[#6b6b70] hover:text-white transition-colors"
                    >
                        Cancel and return to dashboard
                    </Link>
                </div>
            </main>
        </div>
    );
}
