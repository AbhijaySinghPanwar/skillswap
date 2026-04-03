/* ─── SkillSwap Shared Utilities ──────────────────────────────────────────── */

// ─── Toast Notifications ──────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
  const $container = $('#toast-container');
  if (!$container.length) {
    $('body').append('<div id="toast-container"></div>');
  }
  const id = 'toast-' + Date.now();
  const $toast = $(`
    <div class="toast-custom toast-${type}" id="${id}">
      <span class="toast-icon"><i class="bi ${icons[type] || icons.info}"></i></span>
      <span class="toast-msg">${message}</span>
      <span class="toast-close" onclick="closeToast('${id}')"><i class="bi bi-x"></i></span>
    </div>
  `);
  $('#toast-container').append($toast);
  setTimeout(() => closeToast(id), 4000);
}

function closeToast(id) {
  const $toast = $('#' + id);
  $toast.addClass('hide');
  setTimeout(() => $toast.remove(), 300);
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function showSpinner(msg = 'Loading...') {
  if (!$('#spinner-overlay').length) {
    $('body').append(`
      <div id="spinner-overlay" class="spinner-overlay">
        <div class="spinner-custom"></div>
        <div class="spinner-text">${msg}</div>
      </div>
    `);
  }
}

function hideSpinner() {
  $('#spinner-overlay').remove();
}

// ─── Auth Check ───────────────────────────────────────────────────────────────
function checkAuth(redirect = true) {
  return $.ajax({ url: '/api/auth/check', method: 'GET' }).then(res => {
    if (!res.loggedIn && redirect) {
      window.location.href = '/login';
      return false;
    }
    return res;
  }).catch(() => {
    if (redirect) window.location.href = '/login';
    return false;
  });
}

function requireGuest() {
  return $.ajax({ url: '/api/auth/check', method: 'GET' }).then(res => {
    if (res.loggedIn) {
      window.location.href = '/dashboard';
      return false;
    }
    return res;
  }).catch(() => false);
}

// ─── Avatar Generator ─────────────────────────────────────────────────────────
function getAvatar(name, size = 'md', index = 0) {
  const gradients = ['avatar-gradient-1', 'avatar-gradient-2', 'avatar-gradient-3', 'avatar-gradient-4'];
  const g = gradients[index % gradients.length];
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return `<div class="avatar avatar-${size} ${g}">${initial}</div>`;
}

// ─── Match Score UI ───────────────────────────────────────────────────────────
function renderMatchScore(score) {
  if (score >= 70) return `<span class="match-score match-high"><i class="bi bi-stars"></i> ${score}% Match</span>`;
  if (score >= 40) return `<span class="match-score match-medium"><i class="bi bi-lightning-fill"></i> ${score}% Match</span>`;
  if (score >= 10) return `<span class="match-score match-low"><i class="bi bi-circle-half"></i> ${score}% Match</span>`;
  return `<span class="match-score match-none"><i class="bi bi-circle"></i> ${score}% Match</span>`;
}

// ─── Skill Badges ─────────────────────────────────────────────────────────────
function renderSkillBadges(skills, type = 'offered') {
  if (!skills || !skills.length) return '<span class="text-muted" style="font-size:0.85rem">None listed</span>';
  const cls = type === 'offered' ? 'skill-badge-offered' : 'skill-badge-wanted';
  return skills.map(s => `<span class="skill-badge ${cls}">${s}</span>`).join('');
}

// ─── Logout ───────────────────────────────────────────────────────────────────
function logout() {
  $.ajax({ url: '/api/auth/logout', method: 'POST' }).always(() => {
    window.location.href = '/';
  });
}

// ─── Relative Time ────────────────────────────────────────────────────────────
function relativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Tag Input Initialization ─────────────────────────────────────────────────
function initTagInput(containerId, inputId, type) {
  const $container = $(`#${containerId}`);
  const $input = $(`#${inputId}`);
  let tags = [];

  $container.on('click', function () { $input.focus(); });

  $input.on('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ',') && $(this).val().trim()) {
      e.preventDefault();
      addTag($(this).val().trim());
      $(this).val('');
    }
    if (e.key === 'Backspace' && !$(this).val() && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  });

  function addTag(tag) {
    if (tags.includes(tag) || tags.length >= 10) return;
    tags.push(tag);
    const cls = type === 'offered' ? 'tag-offered' : 'tag-wanted';
    $input.before(`
      <span class="tag-item ${cls}" data-tag="${tag}">
        ${tag}
        <span class="tag-remove" onclick="removeTagFromInput('${containerId}', '${tag}')">×</span>
      </span>
    `);
  }

  function removeTag(tag) {
    tags = tags.filter(t => t !== tag);
    $container.find(`[data-tag="${tag}"]`).remove();
  }

  window[`removeTagFromInput`] = function (cid, tag) {
    if (cid === containerId) removeTag(tag);
  };

  $container._getTags = () => tags;
  $container._setTags = (newTags) => {
    tags = [];
    $container.find('.tag-item').remove();
    newTags.forEach(t => addTag(t));
  };
  $container.data('getTags', () => tags);
  $container.data('setTags', (newTags) => {
    tags = [];
    $container.find('.tag-item').remove();
    newTags.forEach(t => addTag(t));
  });
  return { getTags: () => tags, setTags: (newTags) => { tags = []; $container.find('.tag-item').remove(); newTags.forEach(t => addTag(t)); } };
}
