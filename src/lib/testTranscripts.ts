/**
 * 25 sample test transcripts for voice command processor evaluation.
 * Covers all actions, entities, edge cases, and ambiguous inputs.
 */

export interface TestTranscript {
    id: number;
    category: 'create' | 'complete' | 'update' | 'delete' | 'query' | 'reflect' | 'edge-case';
    transcript: string;
    expectedAction: string;
    expectedEntity: string;
    description: string;
}

export const TEST_TRANSCRIPTS: TestTranscript[] = [
    // ─── CREATE (5) ──────────────────────────────────────────────
    {
        id: 1,
        category: 'create',
        transcript: 'Add a task to buy groceries by Friday',
        expectedAction: 'create',
        expectedEntity: 'task',
        description: 'Simple task creation with due date',
    },
    {
        id: 2,
        category: 'create',
        transcript: 'Create a new habit to drink eight glasses of water daily',
        expectedAction: 'create',
        expectedEntity: 'habit',
        description: 'Habit creation with quantity',
    },
    {
        id: 3,
        category: 'create',
        transcript: 'Set a goal to run a marathon by December',
        expectedAction: 'create',
        expectedEntity: 'goal',
        description: 'Goal with deadline',
    },
    {
        id: 4,
        category: 'create',
        transcript: 'Add task call the dentist high priority',
        expectedAction: 'create',
        expectedEntity: 'task',
        description: 'Task with priority level',
    },
    {
        id: 5,
        category: 'create',
        transcript: 'Start tracking my meditation habit',
        expectedAction: 'create',
        expectedEntity: 'habit',
        description: 'Implicit habit creation',
    },

    // ─── COMPLETE (3) ────────────────────────────────────────────
    {
        id: 6,
        category: 'complete',
        transcript: 'I finished my morning run',
        expectedAction: 'complete',
        expectedEntity: 'habit',
        description: 'Complete with past tense',
    },
    {
        id: 7,
        category: 'complete',
        transcript: 'Mark exercise as done',
        expectedAction: 'complete',
        expectedEntity: 'habit',
        description: 'Explicit mark as done',
    },
    {
        id: 8,
        category: 'complete',
        transcript: 'Done with the grocery shopping task',
        expectedAction: 'complete',
        expectedEntity: 'task',
        description: 'Task completion',
    },

    // ─── UPDATE (3) ──────────────────────────────────────────────
    {
        id: 9,
        category: 'update',
        transcript: 'Change my water intake goal to ten glasses',
        expectedAction: 'update',
        expectedEntity: 'habit',
        description: 'Update numeric value',
    },
    {
        id: 10,
        category: 'update',
        transcript: 'Move the dentist appointment to next Monday',
        expectedAction: 'update',
        expectedEntity: 'task',
        description: 'Reschedule with date',
    },
    {
        id: 11,
        category: 'update',
        transcript: 'Set my marathon goal deadline to January',
        expectedAction: 'update',
        expectedEntity: 'goal',
        description: 'Update goal deadline',
    },

    // ─── DELETE (2) ──────────────────────────────────────────────
    {
        id: 12,
        category: 'delete',
        transcript: 'Remove the task about cleaning the garage',
        expectedAction: 'delete',
        expectedEntity: 'task',
        description: 'Delete task by name',
    },
    {
        id: 13,
        category: 'delete',
        transcript: 'Stop tracking my caffeine habit',
        expectedAction: 'delete',
        expectedEntity: 'habit',
        description: 'Implicit habit deletion',
    },

    // ─── QUERY (3) ────────────────────────────────────────────────
    {
        id: 14,
        category: 'query',
        transcript: 'What tasks do I have due this week',
        expectedAction: 'query',
        expectedEntity: 'task',
        description: 'Query with time filter',
    },
    {
        id: 15,
        category: 'query',
        transcript: 'How did I sleep last night',
        expectedAction: 'query',
        expectedEntity: 'sleep',
        description: 'Sleep query',
    },
    {
        id: 16,
        category: 'query',
        transcript: 'Show me my habit streaks',
        expectedAction: 'query',
        expectedEntity: 'habit',
        description: 'Query habit data',
    },

    // ─── REFLECT (4) ─────────────────────────────────────────────
    {
        id: 17,
        category: 'reflect',
        transcript: 'Log my mood as happy, I had a great day at work',
        expectedAction: 'reflect',
        expectedEntity: 'mood',
        description: 'Mood log with context',
    },
    {
        id: 18,
        category: 'reflect',
        transcript: 'I slept seven hours last night and feel well rested',
        expectedAction: 'reflect',
        expectedEntity: 'sleep',
        description: 'Sleep log with duration and quality',
    },
    {
        id: 19,
        category: 'reflect',
        transcript: 'Journal entry: Today I learned about mindfulness and practiced deep breathing for ten minutes',
        expectedAction: 'reflect',
        expectedEntity: 'journal',
        description: 'Journal with detailed content',
    },
    {
        id: 20,
        category: 'reflect',
        transcript: 'My energy level is about six out of ten today',
        expectedAction: 'reflect',
        expectedEntity: 'mood',
        description: 'Numeric mood rating',
    },

    // ─── EDGE CASES (5) ──────────────────────────────────────────
    {
        id: 21,
        category: 'edge-case',
        transcript: 'asdfghjkl random noise blah',
        expectedAction: 'unknown',
        expectedEntity: 'unknown',
        description: 'Gibberish input',
    },
    {
        id: 22,
        category: 'edge-case',
        transcript: 'Maybe I should start running but I also want to read more books',
        expectedAction: 'create',
        expectedEntity: 'goal',
        description: 'Ambiguous multi-intent',
    },
    {
        id: 23,
        category: 'edge-case',
        transcript: 'Hello',
        expectedAction: 'unknown',
        expectedEntity: 'unknown',
        description: 'Greeting, no actionable intent',
    },
    {
        id: 24,
        category: 'edge-case',
        transcript: 'I want to create a task and also log my mood and track my sleep and set a new goal',
        expectedAction: 'create',
        expectedEntity: 'task',
        description: 'Multi-step request (should focus on primary)',
    },
    {
        id: 25,
        category: 'edge-case',
        transcript: 'Ummm so like I kinda wanna maybe possibly start working out or something I guess',
        expectedAction: 'create',
        expectedEntity: 'habit',
        description: 'Hesitant/uncertain natural speech',
    },
];
