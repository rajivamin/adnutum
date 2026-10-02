export const CONTROL_PLANE_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AD NŪTUM Control Plane</title>
  <style>
    :root {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #0f172a;
      background: #eef3f8;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; }
    button, input, textarea { font: inherit; }
    button { cursor: pointer; }
    .shell { display: grid; grid-template-columns: 245px 1fr; min-height: 100vh; }
    aside {
      background: #07111f; color: white; padding: 28px 20px; display: flex; flex-direction: column;
      position: sticky; top: 0; height: 100vh;
    }
    .brand { font-weight: 950; letter-spacing: .08em; font-size: 24px; }
    .brand span { color: #ff8a00; }
    .tagline { margin-top: 7px; color: #9fb0c5; font-size: 12px; line-height: 1.5; }
    nav { margin-top: 36px; display: grid; gap: 8px; }
    nav button {
      text-align: left; width: 100%; background: transparent; color: #b9c7d8; border: 0; padding: 11px 12px;
      border-radius: 10px; font-weight: 750;
    }
    nav button.active, nav button:hover { background: #132238; color: white; }
    .aside-foot { margin-top: auto; border-top: 1px solid #20314a; padding-top: 18px; color: #8193a9; font-size: 11px; }
    main { padding: 34px clamp(20px, 4vw, 56px) 70px; min-width: 0; }
    .topbar { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 26px; }
    h1 { margin: 0; font-size: clamp(30px, 4vw, 48px); letter-spacing: -.04em; }
    .kicker { font-size: 12px; text-transform: uppercase; letter-spacing: .12em; font-weight: 900; color: #49617d; margin-bottom: 8px; }
    .muted { color: #64748b; }
    .demo-badge { background: #fff7e8; color: #9a5700; border: 1px solid #f2d7a5; padding: 9px 12px; border-radius: 999px; font-weight: 850; font-size: 12px; white-space: nowrap; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
    .stat, .card { background: white; border: 1px solid #dbe4ee; border-radius: 18px; box-shadow: 0 8px 24px rgba(15,23,42,.04); }
    .stat { padding: 18px; }
    .stat-label { color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .stat-value { font-size: 30px; font-weight: 950; margin-top: 6px; }
    .grid { display: grid; grid-template-columns: 1.45fr .85fr; gap: 18px; }
    .card { padding: 20px; min-width: 0; }
    .card h2 { margin: 0 0 4px; font-size: 18px; }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    .btn { border: 0; border-radius: 11px; padding: 10px 13px; font-weight: 850; background: #0d4de8; color: white; }
    .btn.secondary { background: #e8eef7; color: #18314f; }
    .btn.danger { background: #b42318; }
    .btn.success { background: #087443; }
    .btn.small { padding: 7px 9px; font-size: 12px; }
    .list { display: grid; gap: 9px; }
    .request {
      border: 1px solid #e1e8f0; border-radius: 14px; padding: 14px; display: grid; grid-template-columns: 1fr auto;
      gap: 8px 14px; align-items: center; background: #fbfdff;
    }
    .request:hover { border-color: #aec2db; }
    .request-title { font-weight: 900; }
    .request-meta { font-size: 12px; color: #64748b; margin-top: 4px; }
    .pill { display: inline-flex; align-items: center; padding: 5px 8px; border-radius: 999px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
    .pill.pending { background: #fff3d7; color: #8a5300; }
    .pill.allowed, .pill.approved { background: #dff6e9; color: #087443; }
    .pill.denied, .pill.rejected { background: #fde8e7; color: #a12b25; }
    .form-grid { display: grid; gap: 12px; }
    label { font-size: 12px; font-weight: 850; color: #44546a; }
    input, textarea {
      width: 100%; border: 1px solid #cfd9e6; background: white; border-radius: 11px; padding: 10px 12px; margin-top: 6px;
      outline: none;
    }
    input:focus, textarea:focus { border-color: #4b7cff; box-shadow: 0 0 0 3px rgba(75,124,255,.12); }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .timeline li { padding: 10px 12px; border-left: 3px solid #b7c7da; background: #f7faff; border-radius: 7px; font-size: 13px; }
    .timeline strong { display: block; }
    .empty { color: #7b8ca1; padding: 22px 0; text-align: center; }
    .hidden { display: none !important; }
    .modal-wrap {
      position: fixed; inset: 0; background: rgba(4,12,24,.68); display: grid; place-items: center; padding: 20px; z-index: 20;
    }
    .modal { width: min(540px, 100%); background: white; border-radius: 20px; padding: 24px; box-shadow: 0 24px 70px rgba(0,0,0,.25); }
    .modal h2 { margin-top: 0; }
    .notice { font-size: 12px; line-height: 1.55; background: #f6f8fb; border: 1px solid #dce5ef; padding: 12px; border-radius: 11px; margin: 14px 0; color: #52657a; }
    .view { display: none; }
    .view.active { display: block; }
    .error { color: #b42318; font-size: 12px; margin-top: 8px; white-space: pre-wrap; }
    @media (max-width: 920px) {
      .shell { grid-template-columns: 1fr; }
      aside { position: static; height: auto; }
      nav { grid-template-columns: repeat(4, 1fr); margin-top: 20px; }
      .aside-foot { display: none; }
      .stats { grid-template-columns: 1fr 1fr; }
      .grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 560px) {
      nav { grid-template-columns: 1fr 1fr; }
      .stats { grid-template-columns: 1fr 1fr; }
      .topbar { flex-direction: column; }
    }
  </style>
</head>
<body>
<div class="shell">
  <aside>
    <div class="brand">AD <span>NŪTUM</span></div>
    <div class="tagline">Authorization infrastructure for AI agents.</div>
    <nav>
      <button data-view="overview" class="active">Overview</button>
      <button data-view="requests">Requests</button>
      <button data-view="agents">Agents</button>
      <button data-view="policy">Policy</button>
    </nav>
    <div class="aside-foot">v0.3 Control Plane<br>Reasoning is not authority.</div>
  </aside>

  <main>
    <div class="topbar">
      <div>
        <div class="kicker">Control Plane</div>
        <h1 id="pageTitle">Authorization overview</h1>
        <div class="muted" id="pageSub">See what agents asked to do, what policy decided, and where human judgment entered.</div>
      </div>
      <div class="demo-badge">Demo environment · no real money moves</div>
    </div>

    <section id="overview" class="view active">
      <div class="stats">
        <div class="stat"><div class="stat-label">Requests</div><div class="stat-value" id="statRequests">—</div></div>
        <div class="stat"><div class="stat-label">Awaiting human</div><div class="stat-value" id="statPending">—</div></div>
        <div class="stat"><div class="stat-label">Approved</div><div class="stat-value" id="statApproved">—</div></div>
        <div class="stat"><div class="stat-label">Agents</div><div class="stat-value" id="statAgents">—</div></div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-head">
            <div><h2>Recent authorization requests</h2><div class="muted">Newest first</div></div>
            <button class="btn secondary small" id="refreshBtn">Refresh</button>
          </div>
          <div id="recentRequests" class="list"><div class="empty">Loading…</div></div>
        </div>

        <div class="card">
          <div class="card-head"><div><h2>Create a test request</h2><div class="muted">Simulate an agent asking for authority.</div></div></div>
          <div class="form-grid">
            <label>Agent<input id="testAgent" value="finance-agent" /></label>
            <label>Refund amount<input id="testAmount" type="number" value="4800" min="1" /></label>
            <label>Customer<input id="testCustomer" value="ABC Manufacturing" /></label>
            <label>Reason<textarea id="testReason" rows="3">Duplicate payment detected</textarea></label>
            <button class="btn" id="createRequestBtn">Ask for authorization</button>
            <div class="error" id="createError"></div>
          </div>
        </div>
      </div>
    </section>

    <section id="requests" class="view">
      <div class="card">
        <div class="card-head"><div><h2>Authorization requests</h2><div class="muted">Open a request to inspect its evidence and audit trail.</div></div></div>
        <div id="allRequests" class="list"><div class="empty">Loading…</div></div>
      </div>
    </section>

    <section id="agents" class="view">
      <div class="grid">
        <div class="card">
          <div class="card-head"><div><h2>Registered agents</h2><div class="muted">Agent identities known to this demo project.</div></div></div>
          <div id="agentList" class="list"><div class="empty">Loading…</div></div>
        </div>
        <div class="card">
          <div class="card-head"><div><h2>Add agent</h2><div class="muted">Create a stable external identity.</div></div></div>
          <div class="form-grid">
            <label>External key<input id="agentKey" placeholder="support-agent" /></label>
            <label>Display name<input id="agentName" placeholder="Customer Support Agent" /></label>
            <button class="btn" id="addAgentBtn">Add agent</button>
            <div class="error" id="agentError"></div>
          </div>
        </div>
      </div>
    </section>

    <section id="policy" class="view">
      <div class="card" style="max-width:760px">
        <div class="card-head"><div><h2>Refund authority policy</h2><div class="muted">The live thresholds used by <code>refund_customer</code>.</div></div></div>
        <div class="notice">This is deliberately narrow. v0.3 proves that policy can be changed in the control plane and enforced by the live authorization API.</div>
        <div class="split">
          <label>Auto-allow below $<input id="automaticBelow" type="number" min="1" /></label>
          <label>Manager approval through $<input id="managerThrough" type="number" min="2" /></label>
        </div>
        <div class="notice">Amounts at or above the first threshold require manager approval until the second threshold. Amounts above the second threshold require owner approval.</div>
        <button class="btn" id="savePolicyBtn">Save policy</button>
        <div class="error" id="policyError"></div>
      </div>
    </section>
  </main>
</div>

<div id="tokenModal" class="modal-wrap">
  <div class="modal">
    <div class="kicker">Operator access</div>
    <h2>Unlock the Control Plane</h2>
    <p class="muted">Enter the Control Plane token configured for this demo Worker. The token is kept only in this browser session.</p>
    <label>Control Plane token<input id="tokenInput" type="password" autocomplete="off" /></label>
    <div class="error" id="tokenError"></div>
    <button class="btn" id="unlockBtn" style="width:100%;margin-top:16px">Unlock</button>
  </div>
</div>

<div id="requestModal" class="modal-wrap hidden">
  <div class="modal">
    <div class="card-head">
      <div><div class="kicker">Authorization request</div><h2 id="detailTitle">Request</h2></div>
      <button class="btn secondary small" id="closeDetail">Close</button>
    </div>
    <div id="detailBody"></div>
  </div>
</div>

<script>
  const state = { token: sessionStorage.getItem('adnutum_control_token') || '', requests: [], agents: [] };

  async function api(path, init = {}) {
    const headers = { 'content-type': 'application/json', 'x-control-plane-token': state.token, ...(init.headers || {}) };
    const response = await fetch(path, { ...init, headers });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(body?.error || body?.message || ('HTTP ' + response.status));
    return body;
  }

  function pillFor(request) {
    const approval = Array.isArray(request.approval_decisions) ? request.approval_decisions[0] : null;
    if (approval?.decision === 'approved') return '<span class="pill approved">approved</span>';
    if (approval?.decision === 'rejected') return '<span class="pill rejected">rejected</span>';
    if (request.decision === 'approval_required') return '<span class="pill pending">awaiting human</span>';
    if (request.decision === 'allow') return '<span class="pill allowed">allowed</span>';
    return '<span class="pill denied">denied</span>';
  }

  function requestCard(r) {
    const payload = r.payload || {};
    const amount = typeof payload.amount === 'number' ? '$' + payload.amount.toLocaleString() : 'No amount';
    const agent = r.agent?.name || r.agent?.external_key || 'Unknown agent';
    return `
      <div class="request">
        <div>
          <div class="request-title">${amount} · ${escapeHtml(r.action)}</div>
          <div class="request-meta">${escapeHtml(agent)} · ${new Date(r.created_at).toLocaleString()}</div>
        </div>
        <div>${pillFor(r)}</div>
        <div class="request-meta">${escapeHtml(r.reason || '')}</div>
        <div><button class="btn secondary small" data-open-request="${r.id}">Open</button></div>
      </div>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  }

  async function loadAll() {
    const [reqData, agentData] = await Promise.all([api('/v1/requests?limit=100'), api('/v1/agents')]);
    state.requests = reqData.requests || [];
    state.agents = agentData.agents || [];

    const pending = state.requests.filter(r => r.decision === 'approval_required' && !(r.approval_decisions || []).length).length;
    const approved = state.requests.filter(r => (r.approval_decisions || [])[0]?.decision === 'approved').length;

    document.querySelector('#statRequests').textContent = state.requests.length;
    document.querySelector('#statPending').textContent = pending;
    document.querySelector('#statApproved').textContent = approved;
    document.querySelector('#statAgents').textContent = state.agents.length;

    const cards = state.requests.length ? state.requests.map(requestCard).join('') : '<div class="empty">No requests yet.</div>';
    document.querySelector('#recentRequests').innerHTML = state.requests.length ? state.requests.slice(0,6).map(requestCard).join('') : '<div class="empty">No requests yet.</div>';
    document.querySelector('#allRequests').innerHTML = cards;

    document.querySelector('#agentList').innerHTML = state.agents.length
      ? state.agents.map(a => '<div class="request"><div><div class="request-title">' + escapeHtml(a.name) + '</div><div class="request-meta">' + escapeHtml(a.external_key) + '</div></div><span class="pill allowed">active</span></div>').join('')
      : '<div class="empty">No agents yet.</div>';

    bindOpenButtons();
  }

  function bindOpenButtons() {
    document.querySelectorAll('[data-open-request]').forEach(btn => {
      btn.onclick = () => openRequest(btn.dataset.openRequest);
    });
  }

  async function openRequest(id) {
    const data = await api('/v1/requests/' + encodeURIComponent(id));
    const r = data.request;
    const p = r.payload || {};
    const approval = data.approvals?.[0];
    document.querySelector('#detailTitle').textContent = (typeof p.amount === 'number' ? '$' + p.amount.toLocaleString() + ' refund' : r.action);
    document.querySelector('#detailBody').innerHTML = `
      <div class="notice"><strong>Agent:</strong> ${escapeHtml(r.agent?.name || r.agent?.external_key || 'Unknown')}<br>
      <strong>Customer:</strong> ${escapeHtml(p.context?.customer || '—')}<br>
      <strong>Reason:</strong> ${escapeHtml(p.context?.reason || '—')}<br>
      <strong>Policy decision:</strong> ${escapeHtml(r.decision)}<br>
      <strong>Required approver:</strong> ${escapeHtml(r.required_approver || 'none')}</div>
      <h3>Audit trail</h3>
      <ul class="timeline">${(data.events || []).map(e => '<li><strong>' + escapeHtml(e.event_type) + '</strong>' + new Date(e.created_at).toLocaleString() + '</li>').join('')}</ul>
      ${r.decision === 'approval_required' && !approval ? `
        <label style="display:block;margin-top:16px">Decision note<textarea id="decisionNote" rows="2">Reviewed in AD NŪTUM Control Plane.</textarea></label>
        <div class="split" style="margin-top:12px">
          <button class="btn danger" id="rejectDetail">Reject</button>
          <button class="btn success" id="approveDetail">Approve</button>
        </div>` : '<div class="notice" style="margin-top:16px"><strong>Final human decision:</strong> ' + escapeHtml(approval?.decision || 'No human decision required') + '</div>'}
    `;
    document.querySelector('#requestModal').classList.remove('hidden');
    const approve = document.querySelector('#approveDetail');
    const reject = document.querySelector('#rejectDetail');
    if (approve) approve.onclick = () => decide(id, 'approved');
    if (reject) reject.onclick = () => decide(id, 'rejected');
  }

  async function decide(id, decision) {
    const note = document.querySelector('#decisionNote')?.value || '';
    await api('/v1/requests/' + encodeURIComponent(id) + '/decision', {
      method: 'POST',
      body: JSON.stringify({ decision, decidedBy: 'control-plane-owner', note })
    });
    document.querySelector('#requestModal').classList.add('hidden');
    await loadAll();
  }

  async function loadPolicy() {
    const data = await api('/v1/policies/refund_customer');
    document.querySelector('#automaticBelow').value = data.rule.automaticBelow;
    document.querySelector('#managerThrough').value = data.rule.managerThrough;
  }

  document.querySelectorAll('nav button').forEach(btn => {
    btn.onclick = async () => {
      document.querySelectorAll('nav button').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
      document.querySelector('#' + btn.dataset.view).classList.add('active');
      const labels = {
        overview: ['Authorization overview','See what agents asked to do, what policy decided, and where human judgment entered.'],
        requests: ['Authorization requests','Every consequential request and its current state.'],
        agents: ['Agents','Stable identities that ask AD NŪTUM for authority.'],
        policy: ['Policy','Define the boundary between automatic action and human judgment.']
      };
      document.querySelector('#pageTitle').textContent = labels[btn.dataset.view][0];
      document.querySelector('#pageSub').textContent = labels[btn.dataset.view][1];
      if (btn.dataset.view === 'policy') await loadPolicy();
    };
  });

  document.querySelector('#createRequestBtn').onclick = async () => {
    const err = document.querySelector('#createError'); err.textContent = '';
    try {
      await api('/v1/authorize', {
        method: 'POST',
        body: JSON.stringify({
          agentId: document.querySelector('#testAgent').value.trim(),
          action: 'refund_customer',
          amount: Number(document.querySelector('#testAmount').value),
          currency: 'USD',
          context: {
            customer: document.querySelector('#testCustomer').value.trim(),
            reason: document.querySelector('#testReason').value.trim()
          }
        })
      });
      await loadAll();
    } catch (e) { err.textContent = e.message; }
  };

  document.querySelector('#addAgentBtn').onclick = async () => {
    const err = document.querySelector('#agentError'); err.textContent = '';
    try {
      await api('/v1/agents', {
        method: 'POST',
        body: JSON.stringify({
          externalKey: document.querySelector('#agentKey').value.trim(),
          name: document.querySelector('#agentName').value.trim()
        })
      });
      document.querySelector('#agentKey').value = '';
      document.querySelector('#agentName').value = '';
      await loadAll();
    } catch (e) { err.textContent = e.message; }
  };

  document.querySelector('#savePolicyBtn').onclick = async () => {
    const err = document.querySelector('#policyError'); err.textContent = '';
    try {
      await api('/v1/policies/refund_customer', {
        method: 'PUT',
        body: JSON.stringify({
          automaticBelow: Number(document.querySelector('#automaticBelow').value),
          managerThrough: Number(document.querySelector('#managerThrough').value)
        })
      });
      await loadPolicy();
      err.style.color = '#087443';
      err.textContent = 'Policy saved.';
      setTimeout(() => { err.textContent=''; err.style.color=''; }, 1800);
    } catch (e) { err.textContent = e.message; }
  };

  document.querySelector('#refreshBtn').onclick = loadAll;
  document.querySelector('#closeDetail').onclick = () => document.querySelector('#requestModal').classList.add('hidden');

  async function unlock() {
    const token = document.querySelector('#tokenInput').value.trim();
    state.token = token;
    try {
      await loadAll();
      sessionStorage.setItem('adnutum_control_token', token);
      document.querySelector('#tokenModal').classList.add('hidden');
      document.querySelector('#tokenError').textContent = '';
    } catch (e) {
      state.token = '';
      document.querySelector('#tokenError').textContent = 'Access denied. Check the Control Plane token.';
    }
  }

  document.querySelector('#unlockBtn').onclick = unlock;
  document.querySelector('#tokenInput').addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });

  if (state.token) {
    loadAll().then(() => document.querySelector('#tokenModal').classList.add('hidden')).catch(() => sessionStorage.removeItem('adnutum_control_token'));
  }
</script>
</body>
</html>`;
