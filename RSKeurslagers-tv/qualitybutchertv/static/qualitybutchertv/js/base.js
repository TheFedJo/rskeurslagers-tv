/* exported playerInitials, teamCounts, isScoreRankedEligible, isMatchTypeEloEligible, api, toast */

// ─── State ────────────────────────────────────────────────────────────────────
const st = {
  players: [],
  matches: [],
  elo: [],
  matchTypes: [], // cache of MatchType objects incl. elo_eligible
  selMember: null,
  matchType: '2v2',
  eloFilter: 'all',
  editingMatchId: null
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function playerInitials(p) {
  return (p?.nickname ?? p.member?.display_name ?? '?').substring(0, 2).toUpperCase()
}

function getCookie(name) {
  return document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + '='))
    ?.split('=')[1] ?? ''
}

function teamCounts(t) {
  return {
    '1v1': [1, 1],
    '1v2': [1, 2],
    '2v2': [2, 2],
    '4v4': [4, 4]
  }[t] || [2, 2]
}

// Mirrors Match.is_score_ranked_eligible() — winner 10-12, loser max 9, no draw
function isScoreRankedEligible(s1, s2) {
  if (s1 === s2) return false
  const hi = Math.max(s1, s2)
  const lo = Math.min(s1, s2)
  return hi >= 10 && hi <= 12 && lo <= 9
}

function isMatchTypeEloEligible(matchType) {
  return st.matchTypes.find((mt) => mt.match_type === matchType)?.elo_eligible ?? false
}

// ─── API Helper ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(`/rskeurslagers-tv/api/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken')
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) throw await res.json()
  return res.json()
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
  let t = document.getElementById('_toast')
  if (!t) {
    t = document.createElement('div')
    t.id = '_toast'
    Object.assign(t.style, {
      position: 'fixed',
      bottom: '1rem',
      right: '1rem',
      padding: '9px 14px',
      fontSize: '13px',
      fontWeight: '500',
      opacity: '0',
      transition: 'opacity .2s',
      pointerEvents: 'none',
      zIndex: '99'
    })
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.style.background = type === 'ok' ? '#1D9E75' : '#E24B4A'
  t.style.color = '#fff'
  t.style.opacity = '1'
  clearTimeout(t._t)
  t._t = setTimeout(() => (t.style.opacity = '0'), 2400)
}
