/**
 * Test phrases for STT provider evaluation.
 * Covers short commands, longer sentences, and edge cases.
 */
export interface TestPhrase {
    id: number;
    category: 'command' | 'sentence' | 'edge-case';
    text: string;
    description: string;
}

export const TEST_PHRASES: TestPhrase[] = [
    // Short commands (5)
    {
        id: 1,
        category: 'command',
        text: 'Log my mood as happy',
        description: 'Simple mood logging command',
    },
    {
        id: 2,
        category: 'command',
        text: 'Start meditation timer',
        description: 'Action command',
    },
    {
        id: 3,
        category: 'command',
        text: 'Add habit drink water',
        description: 'Habit creation command',
    },
    {
        id: 4,
        category: 'command',
        text: 'Mark exercise as done',
        description: 'Completion command',
    },
    {
        id: 5,
        category: 'command',
        text: 'Show my weekly report',
        description: 'Navigation command',
    },

    // Longer sentences (5)
    {
        id: 6,
        category: 'sentence',
        text: 'I completed thirty minutes of exercise today and I feel great about my progress',
        description: 'Longer reflection with numbers',
    },
    {
        id: 7,
        category: 'sentence',
        text: 'Today I woke up at six thirty and meditated for fifteen minutes before breakfast',
        description: 'Time references and sequence',
    },
    {
        id: 8,
        category: 'sentence',
        text: 'I want to track my sleep quality, water intake, and daily steps as new habits',
        description: 'List of items in natural speech',
    },
    {
        id: 9,
        category: 'sentence',
        text: 'My energy level is about seven out of ten and I slept around seven hours last night',
        description: 'Multiple numeric values',
    },
    {
        id: 10,
        category: 'sentence',
        text: 'Set a reminder to journal every evening at nine PM starting from tomorrow',
        description: 'Complex command with time and date',
    },

    // Edge cases (5)
    {
        id: 11,
        category: 'edge-case',
        text: 'Log caffeine intake two hundred milligrams',
        description: 'Technical measurement terms',
    },
    {
        id: 12,
        category: 'edge-case',
        text: 'Rate my productivity eight point five out of ten',
        description: 'Decimal numbers in speech',
    },
    {
        id: 13,
        category: 'edge-case',
        text: 'I did yoga, stretching, and breathwork — three activities total',
        description: 'Punctuation-heavy with em-dash',
    },
    {
        id: 14,
        category: 'edge-case',
        text: 'The word read can mean present or past tense depending on context',
        description: 'Homophone and ambiguous words',
    },
    {
        id: 15,
        category: 'edge-case',
        text: 'Schedule check-in for January twenty-third twenty twenty-seven',
        description: 'Hyphenated words and future dates',
    },
];
