/**
 * Jira Cloud REST API v3 integration service
 * Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 */

export interface JiraConfig {
  url: string; // e.g. https://company.atlassian.net
  email: string;
  apiToken: string;
  projectKey?: string; // e.g. "SEC" - optional, can be inferred from first ticket
}

export interface JiraIssue {
  key: string; // e.g. "SEC-123"
  fields: {
    summary: string;
    description?: any; // ADF format
    status: { name: string };
    priority?: { name: string };
    created: string;
    updated: string;
  };
}

export interface CreateIssueRequest {
  summary: string;
  description: string;
  priority: string; // Critical, High, Medium, Low
  projectKey: string;
  issueType?: string; // default "Bug"
  labels?: string[];
}

export class JiraService {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: JiraConfig) {
    this.baseUrl = config.url.replace(/\/$/, '');
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    this.authHeader = `Basic ${auth}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text();
      let detail = text;
      try {
        const json = JSON.parse(text);
        detail = json.errorMessages?.join(', ') || json.errors || text;
      } catch {
        /* keep text */
      }
      throw new Error(`Jira API ${res.status}: ${detail}`);
    }

    return res.json();
  }

  /**
   * Test connection by fetching current user info
   */
  async testConnection(): Promise<{ ok: boolean; user?: string; error?: string }> {
    try {
      const user = await this.request<{ displayName: string; emailAddress: string }>(
        'GET',
        '/rest/api/3/myself',
      );
      return { ok: true, user: user.displayName };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Create a new Jira issue from a ThreatPulse ticket
   */
  async createIssue(req: CreateIssueRequest): Promise<{ key: string; id: string; self: string }> {
    // Convert plain-text description to Atlassian Document Format (ADF)
    const descriptionAdf = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: req.description }],
        },
      ],
    };

    const payload = {
      fields: {
        project: { key: req.projectKey },
        summary: req.summary,
        description: descriptionAdf,
        issuetype: { name: req.issueType || 'Bug' },
        priority: { name: this.mapPriority(req.priority) },
        labels: req.labels || ['threatpulse', 'security'],
      },
    };

    return this.request<{ key: string; id: string; self: string }>('POST', '/rest/api/3/issue', payload);
  }

  /**
   * Fetch issue details by key
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    return this.request<JiraIssue>(
      'GET',
      `/rest/api/3/issue/${issueKey}?fields=summary,description,status,priority,created,updated`,
    );
  }

  /**
   * Map ThreatPulse priority to Jira priority names
   * (Jira default priorities: Highest, High, Medium, Low, Lowest)
   */
  private mapPriority(tp: string): string {
    const upper = tp.toUpperCase();
    if (upper === 'CRITICAL') return 'Highest';
    if (upper === 'HIGH') return 'High';
    if (upper === 'MEDIUM') return 'Medium';
    if (upper === 'LOW') return 'Low';
    return 'Medium';
  }

  /**
   * Map Jira status name to ThreatPulse ticket status
   */
  static mapStatus(jiraStatusName: string): string {
    const lower = jiraStatusName.toLowerCase();
    if (lower.includes('done') || lower.includes('closed')) return 'CLOSED';
    if (lower.includes('resolved')) return 'RESOLVED';
    if (lower.includes('progress') || lower.includes('dev')) return 'IN_PROGRESS';
    if (lower.includes('open') || lower.includes('to do')) return 'CREATED';
    return 'CREATED';
  }
}
