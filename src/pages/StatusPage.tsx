import { useEffect, useState } from 'react';

interface IssueStats {
  total: number;
  open: number;
  closed: number;
  completionPercent: number;
}

interface MilestoneProgress {
  id: number;
  title: string;
  dueDate: string | null;
  openIssues: number;
  closedIssues: number;
  completionPercent: number;
}

interface AssigneeWorkload {
  id: number;
  name: string;
  username: string;
  avatarUrl: string;
  openIssues: number;
}

interface RecentClosed {
  iid: number;
  title: string;
  closedAt: string;
  webUrl: string;
  assignee: string | null;
}

interface Blocker {
  iid: number;
  title: string;
  labels: string[];
  createdAt: string;
  webUrl: string;
  assignee: string | null;
}

interface StatusData {
  issueStats: IssueStats;
  milestones: MilestoneProgress[];
  assignees: AssigneeWorkload[];
  recentClosed: RecentClosed[];
  blockers: Blocker[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch('/api/admin/project-status');
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json: StatusData = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-gray-600">Loading project status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-800">Error loading status</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { issueStats, milestones, assignees, recentClosed, blockers } = data;

  return (
    <div className="min-h-dvh bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">Project Status</h1>

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card label="Total Issues" value={issueStats.total} />
          <Card label="Open" value={issueStats.open} color="text-amber-600" />
          <Card label="Closed" value={issueStats.closed} color="text-green-600" />
          <Card
            label="Completion"
            value={`${issueStats.completionPercent}%`}
            color="text-indigo-600"
          />
        </div>

        {/* Milestone Progress */}
        {milestones.length > 0 && (
          <Section title="Milestones">
            <div className="space-y-4">
              {milestones.map((ms) => (
                <div key={ms.id} className="rounded-lg border bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-gray-900">{ms.title}</span>
                    <span className="text-sm text-gray-500">
                      {ms.dueDate ? `Due ${formatDate(ms.dueDate)}` : 'No due date'}
                    </span>
                  </div>
                  <ProgressBar percent={ms.completionPercent} />
                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>
                      {ms.closedIssues}/{ms.closedIssues + ms.openIssues} issues
                    </span>
                    <span>{ms.completionPercent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Assignee Workload */}
        {assignees.length > 0 && (
          <Section title="Assignee Workload">
            <div className="divide-y rounded-lg border bg-white">
              {assignees.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <img src={a.avatarUrl} alt={a.name} className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-500">@{a.username}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                    {a.openIssues} open
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Recent Activity */}
        {recentClosed.length > 0 && (
          <Section title="Recently Closed">
            <div className="divide-y rounded-lg border bg-white">
              {recentClosed.map((issue) => (
                <a
                  key={issue.iid}
                  href={issue.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-3 hover:bg-gray-50"
                >
                  <p className="text-sm font-medium text-gray-900">
                    #{issue.iid} {issue.title}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Closed {formatDate(issue.closedAt)}
                    {issue.assignee && ` by ${issue.assignee}`}
                  </p>
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Blockers */}
        {blockers.length > 0 && (
          <Section title="Blockers">
            <div className="divide-y rounded-lg border border-red-200 bg-white">
              {blockers.map((b) => (
                <a
                  key={b.iid}
                  href={b.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-3 hover:bg-red-50"
                >
                  <p className="text-sm font-medium text-red-800">
                    #{b.iid} {b.title}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {b.labels.map((label) => (
                      <span
                        key={label}
                        className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Created {formatDate(b.createdAt)}
                    {b.assignee && ` - ${b.assignee}`}
                  </p>
                </a>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  color = 'text-gray-900',
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}
