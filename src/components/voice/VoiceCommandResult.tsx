import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import type { CommandResult } from '../../utils/commandTypes';

const ACTION_ICONS: Record<string, string> = {
    create: '➕',
    complete: '✅',
    update: '✏️',
    delete: '🗑️',
    query: '🔍',
    reflect: '💭',
    unknown: '❓',
};

const ENTITY_COLORS: Record<string, string> = {
    task: 'bg-blue-100 text-blue-700',
    habit: 'bg-green-100 text-green-700',
    journal: 'bg-purple-100 text-purple-700',
    mood: 'bg-amber-100 text-amber-700',
    sleep: 'bg-indigo-100 text-indigo-700',
    goal: 'bg-rose-100 text-rose-700',
    unknown: 'bg-gray-100 text-gray-600',
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
    const pct = Math.round(confidence * 100);
    const color =
        pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500';
    return <span className={`text-[10px] font-mono font-bold ${color}`}>{pct}%</span>;
}

function ResultCard({ result }: { result: CommandResult }) {
    const isError = result.action === 'unknown';
    const icon = ACTION_ICONS[result.action] || '❓';
    const entityColor = ENTITY_COLORS[result.entity] || ENTITY_COLORS.unknown;

    return (
        <div
            className={`rounded-lg border p-3 text-xs transition-all ${
                isError
                    ? 'border-red-200 bg-red-50/80'
                    : 'border-slate-200 bg-white/90'
            }`}
        >
            {/* Action + Entity header */}
            <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{icon}</span>
                <span className="font-bold text-slate-800 capitalize">{result.action}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${entityColor}`}>
                    {result.entity}
                </span>
                <span className="ml-auto"><ConfidenceBadge confidence={result.confidence} /></span>
            </div>

            {/* Error message */}
            {'error' in result && result.error && (
                <p className="text-red-500 text-[11px] mb-1">{result.error}</p>
            )}

            {/* Extracted parameters */}
            {!isError && result.params && Object.keys(result.params).length > 0 && (
                <div className="space-y-1 mt-1">
                    {Object.entries(result.params).map(([key, value]) => {
                        if (value === undefined || value === null) return null;
                        return (
                            <div key={key} className="flex items-start gap-1.5">
                                <span className="text-slate-400 font-medium min-w-[60px]">{key}:</span>
                                <span className="text-slate-700 break-all">
                                    {Array.isArray(value) ? value.join(', ') : String(value)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function VoiceCommandResult() {
    const { isProcessing, lastResult, error, clearResult } = useVoiceCommand();

    if (!isProcessing && !lastResult && !error) return null;

    return (
        <div className="mt-2">
            {/* Processing indicator */}
            {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                    <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    Processing command...
                </div>
            )}

            {/* Error */}
            {error && !isProcessing && (
                <div className="text-xs text-red-500 bg-red-50 rounded-lg p-2">
                    {error}
                </div>
            )}

            {/* Result */}
            {lastResult && !isProcessing && (
                <div>
                    <ResultCard result={lastResult} />
                    <button
                        onClick={clearResult}
                        className="text-[10px] text-slate-400 hover:text-slate-600 mt-1 underline cursor-pointer"
                    >
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
}
