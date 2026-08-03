import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const API = 'https://api.github.com';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await req.json();
    const repo = body?.repo;        // "owner/name"
    const branch = body?.branch;     // target branch (created from default if missing)
    const message = body?.message || 'Port packet update';
    const files = Array.isArray(body?.files) ? body.files : []; // [{ path, content }]

    if (!repo || !branch || files.length === 0) {
      return Response.json({ error: 'repo, branch, and files[] are required' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');
    if (!accessToken) return Response.json({ error: 'GitHub not connected' }, { status: 401 });

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    const gh = (path, opts) => fetch(`${API}${path}`, { headers, ...opts }).then(async (r) => {
      const text = await r.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!r.ok) throw new Error(`GitHub ${r.status} ${path}: ${typeof data === 'string' ? data : JSON.stringify(data?.message || data)}`);
      return data;
    });

    // 1. Resolve default branch (to branch from if target branch is new)
    const repoInfo = await gh(`/repos/${repo}`);
    const defaultBranch = repoInfo.default_branch;

    // 2. Get the head commit of the target branch (or create it off default)
    let parentSha;
    let refExists = true;
    try {
      const ref = await gh(`/repos/${repo}/git/refs/heads/${branch}`);
      parentSha = ref.object.sha;
    } catch {
      refExists = false;
      const defRef = await gh(`/repos/${repo}/git/refs/heads/${defaultBranch}`);
      parentSha = defRef.object.sha;
    }

    // 3. Get the base tree of that commit
    const parentCommit = await gh(`/repos/${repo}/git/commits/${parentSha}`);
    const baseTree = parentCommit.tree.sha;

    // 4. Create a new tree with the files
    const tree = await gh(`/repos/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTree,
        tree: files.map((f) => ({
          path: f.path,
          mode: '100644',
          type: 'blob',
          content: f.content
        }))
      })
    });

    // 5. Create the commit
    const commit = await gh(`/repos/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: tree.sha,
        parents: [parentSha]
      })
    });

    // 6. Create or update the ref to point to the new commit
    if (refExists) {
      await gh(`/repos/${repo}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha })
      });
    } else {
      await gh(`/repos/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha })
      });
    }

    // 7. Open a PR if a title is provided
    let pr = null;
    if (body.prTitle) {
      pr = await gh(`/repos/${repo}/pulls`, {
        method: 'POST',
        body: JSON.stringify({
          title: body.prTitle,
          head: branch,
          base: defaultBranch,
          body: body.prBody || ''
        })
      });
    }

    return Response.json({
      ok: true,
      repo,
      branch,
      commitSha: commit.sha,
      commitUrl: commit.html_url,
      files: files.length,
      createdBranch: !refExists,
      pr: pr ? { number: pr.number, url: pr.html_url } : null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}