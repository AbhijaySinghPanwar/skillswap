/* ─── Dashboard Logic ────────────────────────────────────────────────────── */

let currentUser = null;
let allUsers = [];
let allRequests = { sent: [], received: [] };
let currentChatUser = null;
let chatPollInterval = null;

$(document).ready(function () {
  // Auth guard
  checkAuth().then(auth => {
    if (!auth || !auth.loggedIn) return;
    loadCurrentUser();
    loadUsers();
    loadRequests();
    loadChatContacts();
  });

  // Live search
  $('#user-search').on('input', function () {
    renderUsers($(this).val().toLowerCase());
  });
});

// ─── Load Current User ────────────────────────────────────────────────────────
function loadCurrentUser() {
  $.get('/api/auth/me').done(res => {
    currentUser = res.user;
    $('#nav-user-name').text(currentUser.name);
    $('#sidebar-name').text(currentUser.name);
    $('#sidebar-avatar').html(getAvatar(currentUser.name, 'md', 0));
  });
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(tabId, btn) {
  $('.tab-pane').removeClass('active');
  $('#' + tabId).addClass('active');
  $('.sidebar-nav-item').removeClass('active');
  $(btn).addClass('active');
  if (tabId === 'tab-chat') loadChatContacts();
  if (tabId === 'tab-matches') loadMatches();
}

// ─── Load All Users ───────────────────────────────────────────────────────────
function loadUsers() {
  $.get('/api/users').done(res => {
    allUsers = res.users;
    $('#stat-users').text(allUsers.length);
    renderUsers('');
  }).fail(() => showToast('Failed to load users', 'error'));
}

function filterUsers(type, btn) {
  $('.filter-btn').removeClass('active');
  $(btn).addClass('active');
  const search = $('#user-search').val().toLowerCase();
  if (type === 'match') {
    renderUsers(search, true);
  } else {
    renderUsers(search, false);
  }
}

function renderUsers(search, matchOnly = false) {
  const $grid = $('#users-grid');
  let filtered = allUsers.filter(u => {
    const nameMatch = u.name.toLowerCase().includes(search);
    const skillMatch = [...(u.skillsOffered || []), ...(u.skillsWanted || [])].some(s => s.toLowerCase().includes(search));
    return nameMatch || skillMatch;
  });
  if (matchOnly) filtered = filtered.filter(u => u.matchScore > 0);

  if (!filtered.length) {
    $grid.html(`<div class="col-12"><div class="empty-state">
      <div class="empty-state-icon"><i class="bi bi-people"></i></div>
      <h5>No users found</h5>
      <p>Try a different search term or check back later</p>
    </div></div>`);
    return;
  }

  $grid.html(filtered.map((u, i) => buildUserCard(u, i)).join(''));
}

function buildUserCard(u, i) {
  const offeredBadges = renderSkillBadges(u.skillsOffered || [], 'offered');
  const wantedBadges = renderSkillBadges(u.skillsWanted || [], 'wanted');
  const matchHtml = renderMatchScore(u.matchScore || 0);
  const avatar = getAvatar(u.name, 'lg', i);

  return `
    <div class="col-sm-6 col-xl-4">
      <div class="user-card" style="animation:fadeInUp 0.4s ${i * 0.05}s ease both">
        <div class="d-flex justify-content-between align-items-start mb-3">
          ${avatar}
          ${matchHtml}
        </div>
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:1rem;margin-bottom:2px">${u.name}</div>
        ${u.bio ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">${u.bio}</div>` : ''}
        <div class="divider"></div>
        <div class="mb-2">
          <div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">
            <i class="bi bi-mortarboard me-1" style="color:var(--accent)"></i>Offers
          </div>
          <div class="d-flex flex-wrap gap-1">${offeredBadges}</div>
        </div>
        <div class="mb-3">
          <div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">
            <i class="bi bi-search-heart me-1" style="color:var(--accent-warm)"></i>Wants
          </div>
          <div class="d-flex flex-wrap gap-1">${wantedBadges}</div>
        </div>
        <button class="btn btn-primary w-100 btn-sm" onclick="openRequestModal('${u._id}', '${u.name.replace(/'/g,"\\'")}', ${JSON.stringify(u.skillsOffered || []).replace(/"/g,"'")}, ${JSON.stringify(u.skillsWanted || []).replace(/"/g,"'")})">
          <i class="bi bi-send me-2"></i>Request Swap
        </button>
      </div>
    </div>`;
}

// ─── Load Matches ─────────────────────────────────────────────────────────────
function loadMatches() {
  const $grid = $('#matches-grid');
  $grid.html('<div class="col-12 text-center py-5"><div class="spinner-custom mx-auto"></div><div class="mt-3 text-muted">Computing matches...</div></div>');

  $.get('/api/users/matches').done(res => {
    $('#stat-matches').text(res.matches.length);
    if (!res.matches.length) {
      $grid.html(`<div class="col-12"><div class="empty-state">
        <div class="empty-state-icon"><i class="bi bi-stars"></i></div>
        <h5>No matches yet</h5>
        <p>Add more skills to your profile to find compatible swap partners</p>
        <a href="/profile" class="btn btn-primary btn-sm mt-3">Update Profile</a>
      </div></div>`);
      return;
    }
    $grid.html(res.matches.map((u, i) => buildMatchCard(u, i)).join(''));
  }).fail(() => showToast('Failed to load matches', 'error'));
}

function buildMatchCard(u, i) {
  const avatar = getAvatar(u.name, 'md', i);
  const pct = u.matchScore || 0;
  const barColor = pct >= 70 ? 'var(--accent)' : pct >= 40 ? 'var(--primary)' : 'var(--accent-warm)';

  const matchedOffered = (u.matchedSkillsOffered || []).map(s => `<span class="skill-badge skill-badge-offered">${s}</span>`).join('');
  const matchedWanted = (u.matchedSkillsWanted || []).map(s => `<span class="skill-badge skill-badge-wanted">${s}</span>`).join('');

  return `
    <div class="col-sm-6 col-xl-4">
      <div class="user-card" style="animation:fadeInUp 0.4s ${i * 0.06}s ease both">
        <div class="d-flex align-items-center gap-3 mb-3">
          ${avatar}
          <div class="flex-1">
            <div style="font-weight:700">${u.name}</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${(u.skillsOffered || []).slice(0,2).join(', ')}</div>
          </div>
        </div>
        <div class="mb-3">
          <div class="d-flex justify-content-between mb-1">
            <span style="font-size:0.78rem;color:var(--text-muted);font-weight:600">COMPATIBILITY</span>
            <span style="font-size:0.78rem;font-weight:700;color:${barColor}">${pct}%</span>
          </div>
          <div style="height:8px;background:var(--surface-3);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${barColor},${barColor}88);border-radius:4px;transition:width 1s ease"></div>
          </div>
        </div>
        ${matchedOffered ? `<div class="mb-2"><div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">They offer what you want:</div><div class="d-flex flex-wrap gap-1">${matchedOffered}</div></div>` : ''}
        ${matchedWanted ? `<div class="mb-3"><div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">They want what you offer:</div><div class="d-flex flex-wrap gap-1">${matchedWanted}</div></div>` : ''}
        <button class="btn btn-primary w-100 btn-sm" onclick="openRequestModal('${u._id}', '${u.name.replace(/'/g,"\\'")}', ${JSON.stringify(u.skillsOffered||[]).replace(/"/g,"'")}, ${JSON.stringify(u.skillsWanted||[]).replace(/"/g,"'")})">
          <i class="bi bi-stars me-2"></i>Request Swap
        </button>
      </div>
    </div>`;
}

// ─── Request Modal ────────────────────────────────────────────────────────────
function openRequestModal(userId, userName, theirOffered, theirWanted) {
  $('#modal-to-user-id').val(userId);
  $('#modal-user-name').text(userName);
  $('#modal-user-skills').text('Offers: ' + (theirOffered.join(', ') || 'None'));
  $('#modal-avatar').html(getAvatar(userName, 'md', 1));

  // Their skills offered = what I can want; my skills offered = what I offer
  const $offered = $('#modal-skill-offered').empty();
  const $wanted = $('#modal-skill-wanted').empty();

  if (currentUser && currentUser.skillsOffered && currentUser.skillsOffered.length) {
    currentUser.skillsOffered.forEach(s => $offered.append(`<option value="${s}">${s}</option>`));
  } else {
    $offered.append('<option value="">-- Add skills to your profile first --</option>');
  }

  if (theirOffered && theirOffered.length) {
    theirOffered.forEach(s => $wanted.append(`<option value="${s}">${s}</option>`));
  } else {
    $wanted.append('<option value="">-- They have no listed skills --</option>');
  }

  $('#modal-message').val('');
  new bootstrap.Modal(document.getElementById('requestModal')).show();
}

function submitRequest() {
  const toUser = $('#modal-to-user-id').val();
  const skillOffered = $('#modal-skill-offered').val();
  const skillWanted = $('#modal-skill-wanted').val();
  const message = $('#modal-message').val().trim();

  if (!skillOffered || !skillWanted) {
    return showToast('Please select skills for the exchange', 'error');
  }

  $('#modal-send-btn').prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Sending...');

  $.ajax({
    url: '/api/requests',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ toUser, skillOffered, skillWanted, message }),
    success: function (res) {
      showToast('Request sent successfully! 🎉', 'success');
      bootstrap.Modal.getInstance(document.getElementById('requestModal')).hide();
      loadRequests();
    },
    error: function (xhr) {
      showToast(xhr.responseJSON?.message || 'Failed to send request', 'error');
    },
    complete: function () {
      $('#modal-send-btn').prop('disabled', false).html('<i class="bi bi-send me-2"></i>Send Request');
    }
  });
}

// ─── Load Requests ────────────────────────────────────────────────────────────
function loadRequests() {
  $.get('/api/requests').done(res => {
    allRequests = res;
    const pendingReceived = res.received.filter(r => r.status === 'pending').length;
    const pendingSent = res.sent.filter(r => r.status === 'pending').length;
    const accepted = [...res.sent, ...res.received].filter(r => r.status === 'accepted').length;

    $('#stat-pending').text(pendingReceived + pendingSent);
    $('#stat-accepted').text(accepted);

    if (pendingReceived > 0) {
      $('#badge-requests, #received-count').text(pendingReceived).show();
    } else {
      $('#badge-requests, #received-count').hide();
    }

    renderReceivedRequests(res.received);
    renderSentRequests(res.sent);
  });
}

function renderReceivedRequests(requests) {
  const $el = $('#received-requests');
  if (!requests.length) {
    $el.html(`<div class="empty-state"><div class="empty-state-icon"><i class="bi bi-inbox"></i></div><h5>No received requests</h5><p>When others send you exchange requests, they'll appear here</p></div>`);
    return;
  }
  $el.html('<div class="d-flex flex-column gap-3">' + requests.map((r, i) => buildReceivedCard(r, i)).join('') + '</div>');
}

function buildReceivedCard(r, i) {
  const from = r.fromUser;
  const avatar = getAvatar(from.name, 'md', i);
  const statusCls = { pending: 'status-pending', accepted: 'status-accepted', rejected: 'status-rejected' }[r.status];
  const statusIcon = { pending: 'bi-hourglass-split', accepted: 'bi-check-circle-fill', rejected: 'bi-x-circle-fill' }[r.status];

  const actions = r.status === 'pending' ? `
    <div class="d-flex gap-2 mt-3">
      <button class="btn btn-success btn-sm flex-1" onclick="updateRequest('${r._id}', 'accepted')">
        <i class="bi bi-check-lg me-1"></i>Accept
      </button>
      <button class="btn btn-danger btn-sm flex-1" onclick="updateRequest('${r._id}', 'rejected')">
        <i class="bi bi-x-lg me-1"></i>Decline
      </button>
    </div>` : '';

  return `
    <div class="request-item" style="animation:fadeInUp 0.3s ${i*0.05}s ease both">
      <div class="d-flex align-items-center gap-3 flex-wrap">
        ${avatar}
        <div class="flex-fill">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span style="font-weight:700">${from.name}</span>
            <span class="badge ${statusCls} skill-badge"><i class="bi ${statusIcon} me-1"></i>${r.status}</span>
          </div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px">
            Offers <strong style="color:var(--accent)">${r.skillOffered}</strong> ↔ Wants <strong style="color:var(--accent-warm)">${r.skillWanted}</strong>
          </div>
          ${r.message ? `<div style="font-size:0.82rem;color:var(--text-secondary);margin-top:6px;font-style:italic">"${r.message}"</div>` : ''}
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${relativeTime(r.createdAt)}</div>
      </div>
      ${actions}
    </div>`;
}

function renderSentRequests(requests) {
  const $el = $('#sent-requests');
  if (!requests.length) {
    $el.html(`<div class="empty-state"><div class="empty-state-icon"><i class="bi bi-send"></i></div><h5>No sent requests</h5><p>Browse users and send your first skill exchange request</p></div>`);
    return;
  }
  $el.html('<div class="d-flex flex-column gap-3">' + requests.map((r, i) => {
    const to = r.toUser;
    const avatar = getAvatar(to.name, 'md', i + 5);
    const statusCls = { pending: 'status-pending', accepted: 'status-accepted', rejected: 'status-rejected' }[r.status];
    const statusIcon = { pending: 'bi-hourglass-split', accepted: 'bi-check-circle-fill', rejected: 'bi-x-circle-fill' }[r.status];
    const cancelBtn = r.status === 'pending' ? `<button class="btn btn-sm mt-2" style="background:var(--glass-light);color:var(--secondary);border:1px solid rgba(255,101,132,0.3);font-size:0.8rem" onclick="cancelRequest('${r._id}')"><i class="bi bi-x me-1"></i>Cancel</button>` : '';
    return `
      <div class="request-item" style="animation:fadeInUp 0.3s ${i*0.05}s ease both">
        <div class="d-flex align-items-center gap-3 flex-wrap">
          ${avatar}
          <div class="flex-fill">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span style="font-weight:700">To: ${to.name}</span>
              <span class="badge ${statusCls} skill-badge"><i class="bi ${statusIcon} me-1"></i>${r.status}</span>
            </div>
            <div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px">
              You offer <strong style="color:var(--accent)">${r.skillOffered}</strong> ↔ Want <strong style="color:var(--accent-warm)">${r.skillWanted}</strong>
            </div>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${relativeTime(r.createdAt)}</div>
        </div>
        ${cancelBtn}
      </div>`;
  }).join('') + '</div>');
}

function showReqTab(tab, btn) {
  $('#req-tabs .nav-link').removeClass('active');
  $(btn).addClass('active');
  if (tab === 'received') {
    $('#received-requests').show();
    $('#sent-requests').hide();
  } else {
    $('#received-requests').hide();
    $('#sent-requests').show();
  }
}

function updateRequest(id, status) {
  $.ajax({
    url: `/api/requests/${id}`,
    method: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({ status }),
    success: function (res) {
      showToast(`Request ${status}! ${status === 'accepted' ? '🎉' : ''}`, status === 'accepted' ? 'success' : 'info');
      loadRequests();
      loadChatContacts();
    },
    error: function (xhr) {
      showToast(xhr.responseJSON?.message || 'Failed to update request', 'error');
    }
  });
}

function cancelRequest(id) {
  $.ajax({
    url: `/api/requests/${id}`,
    method: 'DELETE',
    success: function () {
      showToast('Request cancelled', 'info');
      loadRequests();
    },
    error: function (xhr) {
      showToast(xhr.responseJSON?.message || 'Failed to cancel', 'error');
    }
  });
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
function loadChatContacts() {
  $.get('/api/messages/contacts').done(res => {
    const $list = $('#chat-contacts-list');
    if (!res.contacts.length) {
      $list.html(`<div class="text-center py-4" style="color:var(--text-muted);font-size:0.82rem"><i class="bi bi-chat-dots-fill d-block mb-2" style="font-size:1.8rem;opacity:0.3"></i>No chat contacts yet.<br>Accept a request to start chatting.</div>`);
      return;
    }
    $list.html(res.contacts.map((c, i) => `
      <div class="chat-contact-item" id="contact-${c._id}" onclick="openChat('${c._id}', '${c.name.replace(/'/g,"\\'")}', ${i})">
        ${getAvatar(c.name, 'sm', i)}
        <div>
          <div style="font-size:0.875rem;font-weight:600">${c.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">Tap to chat</div>
        </div>
      </div>`).join(''));
  });
}

function openChat(userId, userName, avatarIdx) {
  currentChatUser = { id: userId, name: userName, avatarIdx };
  if (chatPollInterval) clearInterval(chatPollInterval);

  $('.chat-contact-item').removeClass('active');
  $(`#contact-${userId}`).addClass('active');

  const $main = $('#chat-main');
  $main.html(`
    <div class="chat-header">
      ${getAvatar(userName, 'sm', avatarIdx)}
      <div>
        <div style="font-weight:700;font-size:0.95rem">${userName}</div>
        <div style="font-size:0.75rem;color:var(--accent)"><i class="bi bi-circle-fill me-1" style="font-size:0.5rem"></i>Active swap partner</div>
      </div>
    </div>
    <div class="messages-list" id="messages-list"></div>
    <div class="chat-input-row">
      <input type="text" class="chat-input" id="chat-input" placeholder="Type a message..." />
      <button class="chat-send-btn" onclick="sendMessage()"><i class="bi bi-send-fill"></i></button>
    </div>
  `);

  $('#chat-input').on('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });

  fetchMessages(userId);
  chatPollInterval = setInterval(() => fetchMessages(userId), 5000);
}

function fetchMessages(userId) {
  $.get(`/api/messages/${userId}`).done(res => {
    const $list = $('#messages-list');
    if (!$list.length) return;
    const atBottom = $list[0].scrollHeight - $list.scrollTop() - $list.outerHeight() < 60;

    if (!res.messages.length) {
      $list.html(`<div class="empty-state" style="padding:2rem"><div class="empty-state-icon" style="font-size:2.5rem"><i class="bi bi-chat-heart"></i></div><h5>No messages yet</h5><p>Say hello and start your skill exchange!</p></div>`);
      return;
    }

    $list.html(res.messages.map(m => {
      const isMine = m.sender._id === (currentUser ? currentUser._id : '');
      return `<div class="d-flex flex-column ${isMine ? 'align-items-end' : 'align-items-start'}">
        <div class="message-bubble ${isMine ? 'message-mine' : 'message-theirs'}">${m.content}</div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;padding:0 6px">${relativeTime(m.createdAt)}</div>
      </div>`;
    }).join(''));

    if (atBottom || true) $list.scrollTop($list[0].scrollHeight);
  });
}

function sendMessage() {
  const content = $('#chat-input').val().trim();
  if (!content || !currentChatUser) return;
  $('#chat-input').val('');

  $.ajax({
    url: '/api/messages',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ receiverId: currentChatUser.id, content }),
    success: function () { fetchMessages(currentChatUser.id); },
    error: function (xhr) { showToast(xhr.responseJSON?.message || 'Failed to send message', 'error'); }
  });
}
