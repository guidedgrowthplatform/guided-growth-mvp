/**
 * Voice command processor types.
 * Defines the structured intent schema returned by GPT-4o-mini.
 */

/** Actions the user can perform */
export type CommandAction =
    | 'create'
    | 'complete'
    | 'update'
    | 'delete'
    | 'query'
    | 'reflect';

/** Entities the actions can target */
export type CommandEntity =
    | 'task'
    | 'habit'
    | 'journal'
    | 'mood'
    | 'sleep'
    | 'goal';

/** Extracted parameters from the transcript */
export interface CommandParams {
    title?: string;
    description?: string;
    notes?: string;
    dueDate?: string;
    time?: string;
    value?: number;
    unit?: string;
    duration?: number;
    tags?: string[];
    priority?: 'low' | 'medium' | 'high';
    [key: string]: string | number | boolean | string[] | undefined;
}

/** The structured response from the command processor */
export interface CommandResponse {
    action: CommandAction;
    entity: CommandEntity;
    params: CommandParams;
    confidence: number; // 0-1
    rawResponse: string;
}

/** Response when the input cannot be understood */
export interface CommandError {
    action: 'unknown';
    entity: 'unknown';
    params: Record<string, never>;
    confidence: 0;
    error: string;
    rawResponse: string;
}

/** Union type for all possible results */
export type CommandResult = CommandResponse | CommandError;

/** Input for the processCommand function */
export interface ProcessCommandInput {
    transcript: string;
}

/** Full result including timing */
export interface ProcessCommandResult {
    result: CommandResult;
    latencyMs: number;
}
