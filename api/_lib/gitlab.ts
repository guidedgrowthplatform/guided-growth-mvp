/**
 * GitLab API client for project status dashboard.
 * Fetches issue stats, milestone progress, assignee workload, etc.
 */

const GITLAB_API = 'https://gitlab.com/api/v4';

function getConfig() {
  const token = process.env.GITLAB_TOKEN;
  const projectId = process.env.GITLAB_PROJECT_ID;
  if (!token || !projectId) {
    throw new Error('Missing GITLAB_TOKEN or GITLAB_PROJECT_ID environment variables');
  }
  return { token, projectId };
}

interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  state: string;
  labels: string[];
  assignee: { id: number; name: string; username: string; avatar_url: string } | null;
  milestone: { id: number; title: string } | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  web_url: string;
}

interface GitLabMilestone {
  id: number;
  iid: number;
  title: string;
  state: string;
  due_date: string | null;
  created_at: string;
}

async function gitlabFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const { token, projectId } = getConfig();
  const url = new URL(`${GITLAB_API}/projects/${projectId}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'PRIVATE-TOKEN': token,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`GitLab API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch all pages of issues matching the given params.
 * GitLab default page size is 20; we use 100 for efficiency.
 */
async function fetchAllIssues(params: Record<string, string> = {}): Promise<GitLabIssue[]> {
  const allIssues: GitLabIssue[] = [];
  let page = 1;
  const perPage = '100';

  while (true) {
    const issues = await gitlabFetch<GitLabIssue[]>('/issues', {
      ...params,
      per_page: perPage,
      page: String(page),
    });
    allIssues.push(...issues);
    if (issues.length < Number(perPage)) break;
    page++;
  }

  return allIssues;
}

export interface IssueStats {
  total: number;
  open: number;
  closed: number;
  completionPercent: number;
}

export async function getIssueStats(): Promise<IssueStats> {
  const [openIssues, closedIssues] = await Promise.all([
    fetchAllIssues({ state: 'opened' }),
    fetchAllIssues({ state: 'closed' }),
  ]);

  const open = openIssues.length;
  const closed = closedIssues.length;
  const total = open + closed;
  const completionPercent = total > 0 ? Math.round((closed / total) * 100) : 0;

  return { total, open, closed, completionPercent };
}

export interface MilestoneProgress {
  id: number;
  title: string;
  state: string;
  dueDate: string | null;
  openIssues: number;
  closedIssues: number;
  completionPercent: number;
}

export async function getMilestoneProgress(): Promise<MilestoneProgress[]> {
  const milestones = await gitlabFetch<GitLabMilestone[]>('/milestones', {
    state: 'active',
    per_page: '20',
  });

  const progress = await Promise.all(
    milestones.map(async (ms) => {
      const [allOpen, allClosed] = await Promise.all([
        fetchAllIssues({ milestone: ms.title, state: 'opened' }),
        fetchAllIssues({ milestone: ms.title, state: 'closed' }),
      ]);

      const openCount = allOpen.length;
      const closedCount = allClosed.length;
      const totalCount = openCount + closedCount;

      return {
        id: ms.id,
        title: ms.title,
        state: ms.state,
        dueDate: ms.due_date,
        openIssues: openCount,
        closedIssues: closedCount,
        completionPercent: totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 0,
      };
    }),
  );

  return progress;
}

export interface AssigneeWorkload {
  id: number;
  name: string;
  username: string;
  avatarUrl: string;
  openIssues: number;
}

export async function getAssigneeWorkload(): Promise<AssigneeWorkload[]> {
  const openIssues = await fetchAllIssues({ state: 'opened' });

  const workloadMap = new Map<number, AssigneeWorkload>();
  for (const issue of openIssues) {
    if (!issue.assignee) continue;
    const { id, name, username, avatar_url } = issue.assignee;
    const existing = workloadMap.get(id);
    if (existing) {
      workloadMap.set(id, { ...existing, openIssues: existing.openIssues + 1 });
    } else {
      workloadMap.set(id, { id, name, username, avatarUrl: avatar_url, openIssues: 1 });
    }
  }

  return Array.from(workloadMap.values()).sort((a, b) => b.openIssues - a.openIssues);
}

export interface RecentClosed {
  id: number;
  iid: number;
  title: string;
  closedAt: string;
  webUrl: string;
  assignee: string | null;
}

export async function getRecentClosed(limit = 5): Promise<RecentClosed[]> {
  const issues = await gitlabFetch<GitLabIssue[]>('/issues', {
    state: 'closed',
    order_by: 'updated_at',
    sort: 'desc',
    per_page: String(limit),
  });

  return issues.map((issue) => ({
    id: issue.id,
    iid: issue.iid,
    title: issue.title,
    closedAt: issue.closed_at ?? issue.updated_at,
    webUrl: issue.web_url,
    assignee: issue.assignee?.name ?? null,
  }));
}

export interface Blocker {
  id: number;
  iid: number;
  title: string;
  labels: string[];
  createdAt: string;
  webUrl: string;
  assignee: string | null;
}

export async function getBlockers(): Promise<Blocker[]> {
  // Fetch issues with priority labels that indicate blockers
  const [highPriority, critical] = await Promise.all([
    gitlabFetch<GitLabIssue[]>('/issues', {
      state: 'opened',
      labels: 'priority::high',
      per_page: '20',
    }),
    gitlabFetch<GitLabIssue[]>('/issues', {
      state: 'opened',
      labels: 'priority::critical',
      per_page: '20',
    }),
  ]);

  // Deduplicate by issue id
  const seen = new Set<number>();
  const allBlockers: Blocker[] = [];

  for (const issue of [...critical, ...highPriority]) {
    if (seen.has(issue.id)) continue;
    seen.add(issue.id);
    allBlockers.push({
      id: issue.id,
      iid: issue.iid,
      title: issue.title,
      labels: issue.labels,
      createdAt: issue.created_at,
      webUrl: issue.web_url,
      assignee: issue.assignee?.name ?? null,
    });
  }

  return allBlockers;
}
