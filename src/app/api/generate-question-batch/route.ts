import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { createClient } from '@/lib/supabase/server';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface QuestionGenerationParams {
    interviewType: string;
    difficulty: string;
    topics: string[];
    count: number;
}

interface GeneratedQuestion {
    title: string;
    description: string;
    difficulty: string;
    type: string;
    constraints?: string[];
    examples?: Array<{
        input: string;
        output: string;
        explanation?: string;
    }>;
    followup_guidelines?: string[];
}

// DIVERSE FALLBACK POOLS - Never repeat questions
const FALLBACK_POOLS: Record<string, GeneratedQuestion[]> = {
    'DSA': [
        {
            title: 'Two Sum',
            description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution.',
            difficulty: 'Easy',
            type: 'DSA',
            constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', 'Only one valid answer exists'],
            examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] = 2 + 7 = 9' }],
            followup_guidelines: ['Ask about time complexity of brute force vs hash map', 'Can you do it in one pass?', 'What if there are multiple solutions?']
        },
        {
            title: 'Valid Parentheses',
            description: 'Given a string s containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid. An input string is valid if: Open brackets must be closed by the same type of brackets, and Open brackets must be closed in the correct order.',
            difficulty: 'Easy',
            type: 'DSA',
            constraints: ['1 <= s.length <= 10^4', 's consists of parentheses only'],
            examples: [{ input: 's = "()"', output: 'true' }, { input: 's = "([)]"', output: 'false' }],
            followup_guidelines: ['What data structure would you use?', 'How do you handle matching pairs?', 'What is the time and space complexity?']
        },
        {
            title: 'Merge Two Sorted Lists',
            description: 'You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list by splicing together the nodes. Return the head of the merged linked list.',
            difficulty: 'Easy',
            type: 'DSA',
            constraints: ['The number of nodes in both lists is in range [0, 50]', '-100 <= Node.val <= 100'],
            examples: [{ input: 'list1 = [1,2,4], list2 = [1,3,4]', output: '[1,1,2,3,4,4]' }],
            followup_guidelines: ['Can you do this iteratively and recursively?', 'What about k sorted lists?', 'Time and space complexity?']
        },
        {
            title: 'Maximum Subarray',
            description: 'Given an integer array nums, find the subarray with the largest sum, and return its sum. A subarray is a contiguous non-empty sequence of elements.',
            difficulty: 'Medium',
            type: 'DSA',
            constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4'],
            examples: [{ input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: 'Subarray [4,-1,2,1] has the largest sum = 6' }],
            followup_guidelines: ['What is Kadanes algorithm?', 'Can you also return the subarray indices?', 'What about divide and conquer approach?']
        },
        {
            title: 'Longest Substring Without Repeating',
            description: 'Given a string s, find the length of the longest substring without repeating characters.',
            difficulty: 'Medium',
            type: 'DSA',
            constraints: ['0 <= s.length <= 5 * 10^4', 's consists of English letters, digits, symbols and spaces'],
            examples: [{ input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc" with length 3' }],
            followup_guidelines: ['How would you use sliding window?', 'What data structure to track characters?', 'Time complexity analysis?']
        },
        {
            title: 'Binary Tree Level Order Traversal',
            description: 'Given the root of a binary tree, return the level order traversal of its nodes values (i.e., from left to right, level by level).',
            difficulty: 'Medium',
            type: 'DSA',
            constraints: ['Number of nodes is in range [0, 2000]', '-1000 <= Node.val <= 1000'],
            examples: [{ input: 'root = [3,9,20,null,null,15,7]', output: '[[3],[9,20],[15,7]]' }],
            followup_guidelines: ['BFS vs DFS approach?', 'How to track level boundaries?', 'What about right-to-left traversal?']
        },
        {
            title: 'Container With Most Water',
            description: 'Given an integer array height of length n representing vertical lines, find two lines that contain the most water. Return the maximum amount of water a container can store.',
            difficulty: 'Medium',
            type: 'DSA',
            constraints: ['n >= 2', '0 <= height[i] <= 10^4'],
            examples: [{ input: 'height = [1,8,6,2,5,4,8,3,7]', output: '49' }],
            followup_guidelines: ['Why does two pointer work?', 'Prove the greedy approach is correct', 'Time complexity?']
        },
        {
            title: 'Coin Change',
            description: 'You are given an integer array coins representing coins of different denominations and an integer amount. Return the fewest number of coins needed to make up that amount. If impossible, return -1.',
            difficulty: 'Medium',
            type: 'DSA',
            constraints: ['1 <= coins.length <= 12', '1 <= coins[i] <= 2^31 - 1', '0 <= amount <= 10^4'],
            examples: [{ input: 'coins = [1,2,5], amount = 11', output: '3', explanation: '11 = 5 + 5 + 1' }],
            followup_guidelines: ['DP recurrence relation?', 'Bottom-up vs top-down?', 'Space optimization?']
        },
        {
            title: 'Number of Islands',
            description: 'Given an m x n 2D binary grid which represents a map of "1"s (land) and "0"s (water), return the number of islands. An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.',
            difficulty: 'Medium',
            type: 'DSA',
            constraints: ['m, n <= 300', 'grid[i][j] is "0" or "1"'],
            examples: [{ input: 'grid = [["1","1","0"],["1","1","0"],["0","0","1"]]', output: '2' }],
            followup_guidelines: ['DFS vs BFS vs Union-Find?', 'How to avoid revisiting?', 'Time and space complexity?']
        },
        {
            title: 'LRU Cache',
            description: 'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. Implement get and put methods in O(1) time.',
            difficulty: 'Hard',
            type: 'DSA',
            constraints: ['1 <= capacity <= 3000', '0 <= key, value <= 10^4', 'At most 2 * 10^5 calls'],
            examples: [{ input: 'LRUCache(2), put(1,1), put(2,2), get(1)', output: 'returns 1' }],
            followup_guidelines: ['What data structures needed?', 'How does doubly linked list help?', 'Thread safety considerations?']
        }
    ],
    'Frontend': [
        {
            title: 'React Component Lifecycle',
            description: 'Explain the React component lifecycle. When would you use useEffect with different dependency arrays? How do you handle cleanup?',
            difficulty: 'Medium',
            type: 'Frontend',
            followup_guidelines: ['Difference between [] and no dependency?', 'Common cleanup patterns?', 'Class vs functional lifecycle?']
        },
        {
            title: 'State Management',
            description: 'Compare different state management solutions in React: useState, useReducer, Context API, and external libraries like Redux or Zustand. When would you use each?',
            difficulty: 'Medium',
            type: 'Frontend',
            followup_guidelines: ['Redux vs Context performance?', 'When is local state enough?', 'Server state vs client state?']
        },
        {
            title: 'Performance Optimization',
            description: 'Discuss React performance optimization techniques. When would you use useMemo, useCallback, and React.memo? What are the tradeoffs?',
            difficulty: 'Hard',
            type: 'Frontend',
            followup_guidelines: ['When NOT to memoize?', 'Virtual list for large data?', 'Profiling techniques?']
        },
        {
            title: 'CSS Box Model and Layout',
            description: 'Explain the CSS box model. How does Flexbox work? When would you use Grid vs Flexbox? Discuss positioning schemes.',
            difficulty: 'Easy',
            type: 'Frontend',
            followup_guidelines: ['box-sizing differences?', 'z-index stacking context?', 'Responsive design patterns?']
        },
        {
            title: 'JavaScript Event Loop',
            description: 'Explain the JavaScript event loop, call stack, and task queue. How do microtasks differ from macrotasks? Give examples.',
            difficulty: 'Hard',
            type: 'Frontend',
            followup_guidelines: ['Promise vs setTimeout order?', 'requestAnimationFrame timing?', 'Why is JS single-threaded?']
        }
    ],
    'Backend': [
        {
            title: 'REST API Design',
            description: 'Design a RESTful API for a blog platform. Discuss endpoints, HTTP methods, status codes, pagination, and error handling.',
            difficulty: 'Medium',
            type: 'Backend',
            followup_guidelines: ['REST vs GraphQL trade-offs?', 'Versioning strategies?', 'Rate limiting implementation?']
        },
        {
            title: 'Database Indexing',
            description: 'Explain database indexing. When should you create indexes? What are the trade-offs? Discuss B-tree vs hash indexes.',
            difficulty: 'Medium',
            type: 'Backend',
            followup_guidelines: ['Composite index column order?', 'When indexes hurt performance?', 'EXPLAIN query analysis?']
        },
        {
            title: 'Authentication and Authorization',
            description: 'Design an authentication system. Compare session-based vs JWT. How would you implement role-based access control?',
            difficulty: 'Medium',
            type: 'Backend',
            followup_guidelines: ['JWT refresh token strategy?', 'Token storage best practices?', 'OAuth2 flow explanation?']
        },
        {
            title: 'Caching Strategies',
            description: 'Discuss caching strategies for a high-traffic application. When would you use Redis vs Memcached? Explain cache invalidation patterns.',
            difficulty: 'Hard',
            type: 'Backend',
            followup_guidelines: ['Cache-aside vs write-through?', 'TTL strategies?', 'Thundering herd problem?']
        },
        {
            title: 'Microservices Communication',
            description: 'Compare synchronous (REST, gRPC) vs asynchronous (message queues) communication in microservices. When would you use each?',
            difficulty: 'Hard',
            type: 'Backend',
            followup_guidelines: ['Event sourcing benefits?', 'Saga pattern for transactions?', 'Service mesh concepts?']
        }
    ],
    'Fullstack': [
        {
            title: 'Real-time Chat Architecture',
            description: 'Design a real-time chat application. Discuss frontend architecture, WebSocket vs SSE, backend scaling, and message persistence.',
            difficulty: 'Hard',
            type: 'Fullstack',
            followup_guidelines: ['Offline message handling?', 'Read receipts implementation?', 'Horizontal scaling strategies?']
        },
        {
            title: 'E-commerce Checkout Flow',
            description: 'Design an e-commerce checkout system. Cover cart management, inventory reservation, payment processing, and order confirmation.',
            difficulty: 'Medium',
            type: 'Fullstack',
            followup_guidelines: ['Race condition prevention?', 'Payment failure handling?', 'Cart abandonment tracking?']
        },
        {
            title: 'File Upload System',
            description: 'Design a file upload system supporting large files. Discuss chunked uploads, progress tracking, resume capability, and storage.',
            difficulty: 'Medium',
            type: 'Fullstack',
            followup_guidelines: ['Presigned URL approach?', 'Image processing pipeline?', 'CDN integration?']
        }
    ],
    'Cybersecurity': [
        {
            title: 'SQL Injection Prevention',
            description: 'Explain SQL injection attacks. How do they work? What are the prevention strategies? Discuss prepared statements and ORM safety.',
            difficulty: 'Medium',
            type: 'Cybersecurity',
            followup_guidelines: ['Second-order injection?', 'Blind SQL injection?', 'WAF limitations?']
        },
        {
            title: 'XSS Attack Mitigation',
            description: 'Explain cross-site scripting (XSS) attacks. Differentiate stored, reflected, and DOM-based XSS. How do you prevent each type?',
            difficulty: 'Medium',
            type: 'Cybersecurity',
            followup_guidelines: ['CSP implementation?', 'Sanitization vs encoding?', 'HttpOnly cookies?']
        },
        {
            title: 'Authentication Security',
            description: 'Design a secure authentication system. Discuss password hashing, brute force protection, 2FA, and session management.',
            difficulty: 'Hard',
            type: 'Cybersecurity',
            followup_guidelines: ['bcrypt vs Argon2?', 'Token binding?', 'Session fixation prevention?']
        }
    ],
    'DevOps': [
        {
            title: 'CI/CD Pipeline Design',
            description: 'Design a CI/CD pipeline for a web application. Discuss stages, testing strategies, deployment approaches, and rollback procedures.',
            difficulty: 'Medium',
            type: 'DevOps',
            followup_guidelines: ['Blue-green vs canary?', 'Feature flags integration?', 'Database migration in CD?']
        },
        {
            title: 'Docker and Containerization',
            description: 'Explain containerization with Docker. How do you write efficient Dockerfiles? Discuss multi-stage builds and security best practices.',
            difficulty: 'Medium',
            type: 'DevOps',
            followup_guidelines: ['Image layer optimization?', 'Non-root user importance?', 'Docker Compose vs K8s?']
        },
        {
            title: 'Kubernetes Orchestration',
            description: 'Explain Kubernetes architecture. Discuss pods, services, deployments, and ingress. How do you handle scaling and self-healing?',
            difficulty: 'Hard',
            type: 'DevOps',
            followup_guidelines: ['ConfigMaps vs Secrets?', 'HPA configuration?', 'Service mesh benefits?']
        }
    ]
};

function getFallbackQuestions(type: string, difficulty: string, count: number): GeneratedQuestion[] {
    const pool = FALLBACK_POOLS[type] || FALLBACK_POOLS['DSA'];

    // Filter by difficulty if specified, but fall back to all if not enough
    let filtered = pool.filter(q => q.difficulty === difficulty);
    if (filtered.length < count) {
        filtered = pool; // Use all if not enough at that difficulty
    }

    // Shuffle and select
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    // Ensure we have enough (repeat if necessary, but shouldn't happen)
    while (selected.length < count) {
        selected.push({
            ...pool[selected.length % pool.length],
            title: pool[selected.length % pool.length].title + ` (${selected.length + 1})`
        });
    }

    // Set correct difficulty
    return selected.map(q => ({ ...q, difficulty, type }));
}

async function generateQuestionBatch(params: QuestionGenerationParams): Promise<GeneratedQuestion[]> {
    const { interviewType, difficulty, topics, count } = params;

    // Build topic context
    const topicContext = topics.length > 0
        ? `Focus on these topics: ${topics.join(', ')}`
        : '';

    // Create prompts based on interview type
    const typeSpecificPrompts: Record<string, string> = {
        'DSA': `Generate ${count} DIFFERENT Data Structures and Algorithms coding problems. ${topicContext}
Each should include:
- Unique problem statement (NO DUPLICATES)
- Constraints (array format)
- Examples with input/output
- Follow-up guidelines for the interviewer`,

        'Frontend': `Generate ${count} DIFFERENT Frontend development questions. ${topicContext}
Cover different areas like React, CSS, JavaScript, performance, testing.
Each with unique focus and follow-up discussion points.`,

        'Backend': `Generate ${count} DIFFERENT Backend development questions. ${topicContext}
Cover different areas like API design, databases, security, caching.
Each with unique focus and follow-up discussion points.`,

        'Fullstack': `Generate ${count} DIFFERENT Full-stack development questions. ${topicContext}
Cover end-to-end design, integration, and scalability.
Each with unique focus and follow-up discussion points.`,

        'Cybersecurity': `Generate ${count} DIFFERENT Cybersecurity questions. ${topicContext}
Cover vulnerabilities, prevention, secure coding.
Each with unique focus and follow-up discussion points.`,

        'DevOps': `Generate ${count} DIFFERENT DevOps questions. ${topicContext}
Cover CI/CD, containers, cloud, monitoring.
Each with unique focus and follow-up discussion points.`
    };

    const systemPrompt = `You are an expert technical interview question generator.

Generate exactly ${count} UNIQUE and DIFFERENT ${interviewType} interview questions at ${difficulty} difficulty level.
${topicContext}

${typeSpecificPrompts[interviewType] || typeSpecificPrompts['DSA']}

CRITICAL RULES:
1. Each question MUST be completely different - different problem, different topic
2. DO NOT REPEAT any question or topic
3. All questions must be ${difficulty} difficulty
4. Return ONLY valid JSON array

Return format:
[
  {
    "title": "Unique Question Title",
    "description": "Clear problem description",
    "difficulty": "${difficulty}",
    "type": "${interviewType}",
    ${interviewType === 'DSA' ? '"constraints": ["constraint 1", "constraint 2"],' : ''}
    ${interviewType === 'DSA' ? '"examples": [{"input": "...", "output": "...", "explanation": "..."}],' : ''}
    "followup_guidelines": [
      "Follow-up question 1",
      "Follow-up question 2",
      "Follow-up question 3"
    ]
  }
]`;

    try {
        console.log(`Calling LLM to generate ${count} unique ${interviewType} questions...`);

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Generate ${count} UNIQUE ${interviewType} questions at ${difficulty} difficulty. Each must be a completely different problem.` }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.9, // Higher temperature for more variety
            max_tokens: 2000 * count,
        });

        const content = completion.choices[0]?.message?.content || '';
        console.log('LLM response length:', content.length);

        // Clean markdown code fences if present
        const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Parse JSON
        const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.error('No JSON array found in LLM response');
            throw new Error('No JSON array found in response');
        }

        const questions: GeneratedQuestion[] = JSON.parse(jsonMatch[0]);
        console.log(`Parsed ${questions.length} questions from LLM`);

        // Validate uniqueness
        const titles = questions.map(q => q.title.toLowerCase());
        const uniqueTitles = new Set(titles);
        if (uniqueTitles.size !== titles.length) {
            console.warn('LLM generated duplicate questions, using fallbacks');
            throw new Error('Duplicate questions detected');
        }

        // Adjust count if needed
        if (questions.length < count) {
            console.warn(`Expected ${count} questions, got ${questions.length}. Padding with fallbacks...`);
            const fallbacks = getFallbackQuestions(interviewType, difficulty, count - questions.length);
            // Avoid duplicates with already generated questions
            for (const fb of fallbacks) {
                if (!titles.includes(fb.title.toLowerCase())) {
                    questions.push(fb);
                    if (questions.length >= count) break;
                }
            }
        } else if (questions.length > count) {
            questions.length = count;
        }

        // Ensure all questions have correct metadata
        questions.forEach(q => {
            q.difficulty = difficulty;
            q.type = interviewType;
        });

        console.log(`✅ Successfully generated ${questions.length} unique questions`);
        return questions;

    } catch (error) {
        console.error('Batch generation error:', error);
        console.log('Falling back to diverse fallback pool...');

        // Return diverse fallbacks - NOT the same question!
        return getFallbackQuestions(interviewType, difficulty, count);
    }
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient();

        // Authenticate
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { interviewType, difficulty, topics, count } = body;

        // Validate
        if (!interviewType || !difficulty || !count) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (count < 1 || count > 10) {
            return NextResponse.json({ error: 'Count must be between 1 and 10' }, { status: 400 });
        }

        console.log(`=== BATCH GENERATION START ===`);
        console.log(`Type: ${interviewType}, Difficulty: ${difficulty}, Count: ${count}`);
        console.log(`Topics: ${topics?.join(', ') || 'none specified'}`);

        // Generate batch
        const questions = await generateQuestionBatch({
            interviewType,
            difficulty,
            topics: topics || [],
            count
        });

        console.log(`=== BATCH GENERATION COMPLETE ===`);
        console.log(`Generated questions: ${questions.map(q => q.title).join(', ')}`);

        return NextResponse.json({ questions });

    } catch (error) {
        console.error('Question batch generation error:', error);
        return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
    }
}
