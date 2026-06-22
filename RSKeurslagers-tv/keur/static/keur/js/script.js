// ─── State ────────────────────────────────────────────────────────────────────
const st = {
    players: [],
    matches: [],
    elo: [],
    matchTypes: [],       // cache of MatchType objects incl. elo_eligible
    selMember: null,
    matchType: '2v2',
    eloFilter: 'all',
    editingMatchId: null,
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function fullName(m) {
    return [m.first_name, m.interject, m.last_name].filter(Boolean).join(' ') || m.name;
}

function memberInitials(m) {
    return ((m.first_name || '?')[0] + (m.last_name || '?')[0]).toUpperCase();
}

function getCookie(name) {
    return document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(name + '='))
        ?.split('=')[1] ?? '';
}

function teamCounts(t) {
    return { '1v1': [1, 1], '1v2': [1, 2], '2v2': [2, 2], '4v4': [4, 4] }[t] || [2, 2];
}




// ─── API Helper ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
    const res = await fetch(`/rskeurslagers-tv/api/${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw await res.json();
    return res.json();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
    let t = document.getElementById('_toast');
    if (!t) {
        t = document.createElement('div');
        t.id = '_toast';
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
            zIndex: '99',
        });
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = type === 'ok' ? '#1D9E75' : '#E24B4A';
    t.style.color = '#fff';
    t.style.opacity = '1';
    clearTimeout(t._t);
    t._t = setTimeout(() => (t.style.opacity = '0'), 2400);
}

// ─── Tab Navigation ───────────────────────────────────────────────────────────
class Tabs {
    constructor(tabNames, tab, sec) {
        this.tabNames = tabNames;
        this.tab = tab;
        this.sec = sec;
        this.tabs = new Map();
        this.sections = new Map();
        this.callbacks = new Map();

        for (const tabName of tabNames) {
            const tabElement     = document.getElementById(tab.prefix + tabName);
            const sectionElement = document.getElementById(sec.prefix + tabName);

            if (!tabElement)
                throw new Error(`Tab element not found: ${tab.prefix}${tabName}`);
            if (!tabElement.classList.contains(tab.class))
                throw new Error(`Tab element "${tab.prefix}${tabName}" must have class "${tab.class}"`);
            if (!sectionElement)
                throw new Error(`Section element not found: ${sec.prefix}${tabName}`);
            if (!sectionElement.classList.contains(sec.class))
                throw new Error(`Section element "${sec.prefix}${tabName}" must have class "${sec.class}"`);

            this.tabs.set(tabName, tabElement);
            this.sections.set(tabName, sectionElement);
        }
    }

    go(tabName) {
        if (!this.tabs.has(tabName)) throw new Error(`Unknown tab: ${tabName}`);
        for (const [name, el] of this.tabs)
            el.classList.toggle(this.tab.active, name === tabName);
        for (const [name, el] of this.sections)
            el.classList.toggle(this.sec.active, name === tabName);
        this.callbacks.get(tabName)?.();
    }

    assignCallback(tabName, callback) {
        this.callbacks.set(tabName, callback);
    }
}

// ─── Members ──────────────────────────────────────────────────────────────────
class Members {
    constructor() {
        this.searchTimer    = null;
        this.searchBar      = document.getElementById('member-search');
        this.searchWrapper  = document.getElementById('member-search-wrap');
        this.nicknameInput  = document.getElementById('nickname-input');
        this.selectedCard   = document.getElementById('selected-member-card');
        this.createBtnWrap  = document.getElementById('create-btn-wrap');
        this.createHint     = document.getElementById('create-hint');
        this.dropdown       = document.getElementById('member-dd');
        this.selectedAvatar = document.getElementById('sel-avatar');
        this.selectedName   = document.getElementById('sel-name');
        this.selectedMeta   = document.getElementById('sel-meta');
        this.selectedStatus = document.getElementById('sel-status-tag');

        document.addEventListener('click', (e) => {
            if (!this.searchWrapper.contains(e.target))
                this.dropdown.style.display = 'none';
        });
    }

    filter() {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(async () => {
            const q = this.searchBar.value.trim();
            if (q.length < 2) { this.dropdown.style.display = 'none'; return; }
            try {
                const results = await api('GET', `members/?search=${encodeURIComponent(q)}`);
                this.showDropdown(results);
            } catch {
                toast(gettext('Leden zoeken mislukt'), 'err');
            }
        }, 300);
    }

    showDropdown(members = []) {
        const playerMemberIds = new Set(st.players.map((p) => p.member?.id));

        if (!members.length) {
            this.dropdown.innerHTML =
                `<div class="no-items-dropdown">${gettext('Geen leden gevonden')}</div>`;
            this.dropdown.style.display = 'block';
            return;
        }

        this.dropdown.innerHTML = members.map((m) => {
            const isPlayer = playerMemberIds.has(m.id);
            const tag = isPlayer
                ? `<span class="tag tag-exists">${gettext('speler')}</span>`
                : `<span class="tag tag-new">${gettext('beschikbaar')}</span>`;
            const encoded = encodeURIComponent(JSON.stringify(m));
            return `<div class="dd-item" data-member="${encoded}">
                <div>
                    <div class="dd-name">${fullName(m)}</div>
                    <div class="dd-gen">${m.generation?.name ?? ''}</div>
                </div>
                ${tag}
            </div>`;
        }).join('');

        this.dropdown.querySelectorAll('.dd-item').forEach((el) => {
            el.addEventListener('click', () => {
                const m = JSON.parse(decodeURIComponent(el.dataset.member));
                this.select(m);
            });
        });

        this.dropdown.style.display = 'block';
    }

    select(m) {
        if (!m) return;
        st.selMember = m;

        this.searchBar.value = fullName(m);
        this.dropdown.style.display = 'none';

        const isPlayer = st.players.some((p) => p.member?.id === m.id);
        this.selectedAvatar.textContent = memberInitials(m);
        this.selectedName.textContent   = fullName(m);
        this.selectedMeta.textContent   = `${m.generation?.name ?? ''} · ${m.birth_date ?? ''}`;
        this.selectedStatus.innerHTML   = isPlayer
            ? `<span class="tag tag-exists">${gettext('al een speler')}</span>`
            : `<span class="tag tag-new">${gettext('nog geen speler')}</span>`;
        this.selectedCard.style.display  = 'block';
        this.createBtnWrap.style.display = 'block';
        this.createHint.textContent      = isPlayer
            ? gettext('Dit lid is al als speler toegevoegd.') : '';
    }

    clearSelection() {
        st.selMember = null;
        this.searchBar.value     = '';
        this.nicknameInput.value = '';
        this.selectedCard.style.display  = 'none';
        this.createBtnWrap.style.display = 'none';
        this.createHint.textContent      = '';
    }
}

// ─── Players ──────────────────────────────────────────────────────────────────
class Players {
    constructor() {
        this.listEl  = document.getElementById('player-list');
        this.countEl = document.getElementById('players-statistic');
    }

    async load() {
        try {
            st.players = await api('GET', 'players/');
            this.render();
            this.countEl.textContent = st.players.length;
        } catch {
            toast(gettext('Spelers laden mislukt'), 'err');
        }
    }

    async create() {
        const m = st.selMember;
        if (!m) { toast(gettext('Kies eerst een lid'), 'err'); return; }

        if (st.players.some((p) => p.member?.id === m.id)) {
            members.createHint.textContent = gettext('Lid is al als speler toegevoegd.');
            return;
        }

        const nickname = members.nicknameInput.value.trim();
        if (nickname.length < 4) { toast(gettext('Nickname te kort'), 'err'); return; }

        try {
            const player = await api('POST', 'players/', { member_id: m.id, nickname });
            st.players.push(player);
            members.clearSelection();
            this.render();
            this.countEl.textContent = st.players.length.toString();
            toast(`${player.member?.display_name ?? nickname} ${gettext('als speler toegevoegd')}`);
        } catch (err) {
            const msg = err?.member?.[0] ?? err?.non_field_errors?.[0]
                ?? gettext('Speler aanmaken mislukt');
            toast(msg, 'err');
            members.createHint.textContent = msg;
        }
    }

    render() {
        if (!st.players.length) {
            this.listEl.innerHTML = `<div class="empty">${gettext('Nog geen spelers.')}</div>`;
            return;
        }
        this.listEl.innerHTML = st.players.map((p) => {
            const ini   = p.member?.initials ?? memberInitials(p.member ?? {});
            const dname = p.member?.display_name ?? p.member?.name ?? 'Unknown';
            const gen   = p.member?.generation?.name ?? '';
            return `
                <div class="player-row">
                    <div class="avatar">${ini}</div>
                    <div class="player-info">
                        <div class="player-data">${p.nickname}</div>
                        <div class="player-metadata">${dname} · ${gen}</div>
                    </div>
                    <div class="mono player-id-text">${p.id.toString().slice(0, 8)}…</div>
                </div>`;
        }).join('');
    }
}

// ─── Match Form ───────────────────────────────────────────────────────────────

// Mirrors Match.is_score_ranked_eligible() — winner 10-12, loser max 9, no draw
function isScoreRankedEligible(s1, s2) {
    if (s1 === s2) return false;
    const hi = Math.max(s1, s2);
    const lo = Math.min(s1, s2);
    return hi >= 10 && hi <= 12 && lo <= 9;
}

function isMatchTypeEloEligible(matchType) {
    return st.matchTypes.find((mt) => mt.match_type === matchType)?.elo_eligible ?? false;
}

class MatchForm {
    constructor() {
        this.sc1            = document.getElementById('sc1');
        this.sc2            = document.getElementById('sc2');
        this.dtInput        = document.getElementById('date-time-played');
        this.teamWrap       = document.getElementById('team-wrap');
        this.submitBtn      = document.getElementById('match-submit-btn');
        this.rankedToggle   = document.getElementById('ranked-toggle');
        this.rankedHint     = document.getElementById('ranked-hint');

        // Re-evaluate eligibility whenever score changes
        this.sc1.addEventListener('input', () => this.updateRankedStatus());
        this.sc2.addEventListener('input', () => this.updateRankedStatus());
    }

    // Called on every score input change and on match type change.
    // Mirrors backend is_score_ranked_eligible + elo_eligible check.
    updateRankedStatus() {
        const s1 = parseInt(this.sc1.value) || 0;
        const s2 = parseInt(this.sc2.value) || 0;
        const scoreOk  = isScoreRankedEligible(s1, s2);
        const typeOk   = isMatchTypeEloEligible(st.matchType);
        const canRank  = scoreOk && typeOk;

        // Disable and uncheck when ineligible; re-enable (and auto-check) when eligible
        this.rankedToggle.disabled = !canRank;
        if (!canRank) {
            this.rankedToggle.checked = false;
        } else if (canRank && !this.rankedToggle._manuallyUnchecked) {
            // Auto-check only if the user hasn't explicitly unchecked
            this.rankedToggle.checked = true;
        }

        // Hint text
        if (!typeOk) {
            this._setHint(gettext('Dit speltype telt niet voor klassement.'), 'ineligible');
        } else if (s1 === 0 && s2 === 0) {
            this._setHint('', '');
        } else if (s1 === s2) {
            this._setHint(gettext('Gelijkspel telt niet voor klassement.'), 'ineligible');
        } else {
            const hi = Math.max(s1, s2), lo = Math.min(s1, s2);
            if (hi < 10) {
                this._setHint(
                    gettext('Winnaar moet minimaal 10 scoren voor klassement.'), 'ineligible'
                );
            } else if (hi > 12) {
                this._setHint(
                    gettext('Winnaar mag maximaal 12 scoren voor klassement.'), 'ineligible'
                );
            } else if (lo > 9) {
                this._setHint(
                    gettext('Verliezer mag maximaal 9 scoren voor klassement.'), 'ineligible'
                );
            } else {
                this._setHint(gettext('Wedstrijd telt voor klassement ✓'), 'eligible');
            }
        }
    }

    _setHint(text, state) {
        this.rankedHint.textContent = text;
        this.rankedHint.className   = `ranked-hint ${state}`;
    }

    setType(el, t) {
        document.querySelectorAll('#type-pills .pill').forEach((p) => p.classList.remove('on'));
        el.classList.add('on');
        st.matchType = t;
        this.renderTeams();
        this.updateRankedStatus(); // re-check elo_eligible for new type
    }

    playerSelectHTML(id) {
        const opts = st.players.map((p) =>
            `<option value="${p.id}">${p.nickname} (${p.member?.display_name ?? p.member?.name ?? ''})</option>`
        ).join('');
        return `
            <div class="field">
                <select id="${id}" style="font-size:13px">
                    <option value="">— ${gettext('kies speler')} —</option>${opts}
                </select>
            </div>`;
    }

    renderTeams() {
        if (!st.players.length) {
            this.teamWrap.innerHTML =
                `<div class="warning-text">${gettext('Voeg eerst spelers toe.')}</div>`;
            return;
        }

        const [t1c, t2c] = teamCounts(st.matchType);
        const buildTeam  = (label, count, prefix) => {
            const col    = document.createElement('div');
            for (let i = 0; i < count; i++)
                col.insertAdjacentHTML('beforeend', this.playerSelectHTML(`${prefix}${i}`));
            return col;
        };
        
        this.teamWrap.innerHTML = '';
        this.teamWrap.appendChild(buildTeam('Team 1', t1c, 't1p'));
        this.teamWrap.appendChild(buildTeam('Team 2', t2c, 't2p'));
    }

    renderTime() {
        if (!this.dtInput) return;
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        this.dtInput.value = now.toISOString().slice(0, 16);
    }

    populate(match) {
        st.editingMatchId = match.id;
        st.matchType      = match.match_type;

        document.querySelectorAll('#type-pills .pill')
            .forEach((p) => p.classList.toggle('on', p.dataset.type === match.match_type));

        this.renderTeams();

        match.participants_detail
            .filter((p) => p.team === 1)
            .forEach((p, i) => { const el = document.getElementById(`t1p${i}`); if (el) el.value = p.player; });
        match.participants_detail
            .filter((p) => p.team === 2)
            .forEach((p, i) => { const el = document.getElementById(`t2p${i}`); if (el) el.value = p.player; });

        this.sc1.value = match.score_team_1;
        this.sc2.value = match.score_team_2;

        if (match.timestamp_played) {
            const dt = new Date(match.timestamp_played);
            dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
            this.dtInput.value = dt.toISOString().slice(0, 16);
        }

        // Set ranked toggle from the saved match value
        this.rankedToggle._manuallyUnchecked = false;
        this.updateRankedStatus();
        if (this.rankedToggle.disabled === false) {
            this.rankedToggle.checked = match.ranked;
        }

        if (this.submitBtn) this.submitBtn.textContent = gettext('Opslaan');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    reset() {
        st.editingMatchId = null;
        this.sc1.value    = 0;
        this.sc2.value    = 0;
        this.rankedToggle._manuallyUnchecked = false;
        this.renderTeams();
        this.renderTime();
        this.updateRankedStatus();
        if (this.submitBtn) this.submitBtn.textContent = gettext('Wedstrijd opslaan');
    }

    collectParticipants() {
        const [t1c, t2c] = teamCounts(st.matchType);
        const t1 = [], t2 = [];

        for (let i = 0; i < t1c; i++) {
            const v = document.getElementById(`t1p${i}`)?.value;
            if (!v) { toast(gettext('Voeg alle spelers van team 1 toe'), 'err'); return null; }
            t1.push(v);
        }
        for (let i = 0; i < t2c; i++) {
            const v = document.getElementById(`t2p${i}`)?.value;
            if (!v) { toast(gettext('Voeg alle spelers van team 2 toe'), 'err'); return null; }
            t2.push(v);
        }

        const all = [...t1, ...t2];
        if (new Set(all).size !== all.length) {
            toast(gettext('Een speler kan niet in beide teams zitten'), 'err');
            return null;
        }

        return [
            ...t1.map((id) => ({ player: id, team: 1, elo_gain: 0 })),
            ...t2.map((id) => ({ player: id, team: 2, elo_gain: 0 })),
        ];
    }

    // Client-side validation before sending — mirrors backend constraints
    _validateScores(s1, s2, ranked) {
        if (s1 === 0 && s2 === 0) {
            toast(gettext('Score kan niet 0-0 zijn'), 'err');
            return false;
        }
        if (s1 > 12 || s2 > 12) {
            toast(gettext('Maximale score is 12'), 'err');
            return false;
        }
        if (ranked && !isScoreRankedEligible(s1, s2)) {
            toast(gettext('Score voldoet niet aan klassementsvoorwaarden (winnaar 10–12, verliezer max 9)'), 'err');
            return false;
        }
        if (ranked && !isMatchTypeEloEligible(st.matchType)) {
            toast(gettext('Dit speltype telt niet voor het klassement'), 'err');
            return false;
        }
        return true;
    }

    async submit() {
        const participants = this.collectParticipants();
        if (!participants) return;

        const s1     = parseInt(this.sc1.value) || 0;
        const s2     = parseInt(this.sc2.value) || 0;
        const ranked = !this.rankedToggle.disabled && this.rankedToggle.checked;

        if (!this._validateScores(s1, s2, ranked)) return;

        const timestamp = this.dtInput?.value
            ? new Date(this.dtInput.value).toISOString()
            : new Date().toISOString();

        const payload = {
            match_type:         st.matchType,
            score_team_1:       s1,
            score_team_2:       s2,
            timestamp_played:   timestamp,
            ranked,
            participants,
        };

        try {
            let savedMatch;

            if (st.editingMatchId) {
                savedMatch = await api('PATCH', `matches/${st.editingMatchId}/`, payload);
                const idx  = st.matches.findIndex((m) => m.id === st.editingMatchId);
                if (idx !== -1) st.matches[idx] = savedMatch;
                this._announceResult(savedMatch, s1, s2, true);
            } else {
                savedMatch = await api('POST', 'matches/', {
                    ...payload,
                    timestamp_uploaded: new Date().toISOString(),
                });
                st.matches.push(savedMatch);
                matchList.countEl.textContent = st.matches.length;
                this._announceResult(savedMatch, s1, s2, false);
            }

            this.reset();
            matchList.render();
            await eloBoard.load();
        } catch (err) {
            // Surface the most specific error from the response
            const msg =
                err?.ranked?.[0] ??
                err?.score_team_1?.[0] ??
                err?.score_team_2?.[0] ??
                err?.participants?.[0] ??
                err?.non_field_errors?.[0] ??
                gettext('Wedstrijd opslaan mislukt');
            toast(msg, 'err');
        }
    }

    _announceResult(match, s1, s2, isEdit) {
        // Confirm what the backend actually saved, not just what we sent
        const verb    = isEdit ? gettext('bijgewerkt') : gettext('opgeslagen');
        const ranking = match.ranked
            ? gettext('telt voor klassement')
            : gettext('telt niet voor klassement');
        toast(`${s1}:${s2} — ${ranking} — ${verb}`);

        // Warn if backend eligibility differs from what we expected
        if (match.is_score_ranked_eligible && !match.ranked) {
            toast(gettext('Score was geschikt maar wedstrijd is niet ranked opgeslagen'), 'err');
        }
    }
}

// Track manual unchecks on the ranked toggle
document.addEventListener('change', (e) => {
    if (e.target.id === 'ranked-toggle' && !e.target.checked) {
        e.target._manuallyUnchecked = true;
    } else if (e.target.id === 'ranked-toggle' && e.target.checked) {
        e.target._manuallyUnchecked = false;
    }
});

// ─── Match List ───────────────────────────────────────────────────────────────
class MatchList {
    constructor() {
        this.listEl     = document.getElementById('match-list');
        this.countEl    = document.getElementById('matches-statistic');
        this.countElLabel    = document.getElementById('matches-statistic-label');
        this.filterBtn  = document.getElementById('ranked-filter-btn');
        this.showRankedOnly = false;
    }

    toggleRankedFilter(btn) {
        this.showRankedOnly = !this.showRankedOnly;
        btn.classList.toggle('on', this.showRankedOnly);
        this.load();
    }

    async load() {
        try {
            const params   = this.showRankedOnly ? '?ranked=true' : '';
            st.matches     = await api('GET', `matches/${params}`);
            this.render();
            this.countEl.textContent = st.matches.length;
            this.countElLabel.textContent = gettext('wedstrijden') + (this.showRankedOnly ? gettext('\n(klassement)') : '');
        } catch {
            toast(gettext('Wedstrijden laden niet gelukt'), 'err');
        }
    }

    render() {
        if (!st.matches.length) {
            this.listEl.innerHTML =
                `<div class="empty">${gettext('Nog geen wedstrijden.')}</div>`;
            return;
        }

        this.listEl.innerHTML = st.matches.sort((ma, mb) => (
            new Date(mb.timestamp_played) - new Date(ma.timestamp_played)
        )).map((m) => {
            const results = m.score_team_1 > m.score_team_2
                ? ['win', 'loss']
                : m.score_team_2 > m.score_team_1
                    ? ['loss', 'win']
                    : ['draw', 'draw'];

            const rankedBadge = m.ranked
                ? `<span class="ranked-badge" title="${gettext('Klassementswedstrijd')}">Klassement</span>`
                : `<span class="unranked-badge" title="${gettext('Vriendschappelijke wedstrijd')}">Vriendschappelijk</span>`;

            return `
                <div class="match-row${m.ranked ? ' match-ranked' : ''}" id="mrow-${m.id}">
                    <div class="match-info">
                        <div class="match-top-row">
                            ${m.match_type} — ${m.score_team_1} : ${m.score_team_2} — ${rankedBadge}
                        </div>
                        ${this.renderParticipants(m.participants_detail ?? [], results)}
                        <div class="match-metadata">${
                            m.timestamp_played
                                ? new Date(m.timestamp_played).toLocaleString()
                                : ''
                        }</div>
                    </div>
                    <button class="match-edit-button" onclick="matchList.edit(${m.id})">
                        ${gettext('Bewerken')}
                    </button>
                </div>`;
        }).join('');
    }

    renderParticipants(participants, results) {
        const renderOne = (p) => {
            const gain = (p.elo_gain > 0 ? '+' : '') + p.elo_gain.toFixed(0);
            return `<div class="participant">
                <span class="elo-gain">${gain}</span> ${p.display_name}
            </div>`;
        };
        const ps1 = participants.filter((p) => p.team === 1).map(renderOne).join('');
        const ps2 = participants.filter((p) => p.team === 2).map(renderOne).join('');
        return `
            <span class="participants-wrapper">
                <div class="participants ${results[0]}">${ps1}</div>
                <div class="participants ${results[1]}">${ps2}</div>
            </span>`;
    }

    edit(id) {
        const match = st.matches.find((m) => m.id === id);
        if (!match) {
            toast('Match not found', 'error')
            return
        }
        tabs.go('matches');     // switch to the match tab
        matchForm.populate(match);
    }
}

// ─── ELO Board ────────────────────────────────────────────────────────────────
class EloBoard {
    constructor() {
        this.listEl = document.getElementById('elo-list');
    }

    setFilter(el, f) {
        document.querySelectorAll('#elo-pills .pill').forEach((p) => p.classList.remove('on'));
        el.classList.add('on');
        st.eloFilter = f;
        this.load();
    }

    async load() {
        try {
            const filter = '';
            st.elo = await api('GET', `elo/${filter}`);

            st.eloByPlayer = new Map();
            for (const elo of st.elo) {
                const id = elo.player.id;

                if (!st.eloByPlayer.has(id)) {
                    st.eloByPlayer.set(id, []);
                }
                st.eloByPlayer.get(id).push(elo);
            }
            this.render();
        } catch {
            toast(gettext('ELO-gegevens laden mislukt'), 'err');
        }
    }

    render() {
        const primaryMatchType = st.eloFilter === 'all' ? '2v2' : st.eloFilter;

        if (!st.elo.filter(elo => elo.match_type.match_type === primaryMatchType).length) {
            this.listEl.innerHTML =
                `<div class="empty">${gettext('Nog geen ELO-gegevens — sla eerst een wedstrijd op.')}</div>`;
            return;
        }

        const players = st.players.map(p => ({ ...p, elos: st.eloByPlayer.get(p.id) || []}));

        const hasElo = (player, matchType = primaryMatchType) =>
            player.elos.some(e => e.match_type.match_type === matchType);

        const getElo = (player, matchType = primaryMatchType) =>
            player.elos.find(e => e.match_type.match_type === matchType);

        const eloClass = elo =>
            elo.elo >= 1400 ? 'e-hi' :
            elo.elo >= 1000 ? 'e-mid' :
            'e-lo';

        const rankedPlayers = players
            .filter(player =>
                st.eloFilter === 'all'
                    ? player.elos.length > 0
                    : hasElo(player)
            )
            .map(player => ({
                ...player,
                primaryElo: getElo(player)
            }))
            .sort((a, b) =>
                (b.primaryElo?.elo ?? -1) -
                (a.primaryElo?.elo ?? -1)
            );
        const isPrim = (matchType) => matchType.match_type === primaryMatchType ? 1 : 0
        // HEADER (grid-aligned)
        const header = `
            <div class="elo-row elo-header">
                <div class="elo-rank">#</div>
                <div class="avatar">${gettext('Speler')}</div>
                <div class="elo-info"></div>
                ${st.matchTypes
                    .sort((a, b) => isPrim(b) - isPrim(a))
                    .filter(mt => mt.elo_eligible)
                    .map(mt =>
                        `<div class="ebadge elo-col-header">${mt.match_type}</div>`
                    )
                    .join('')}
            </div>
        `;

        const renderBadges = (player) => {
            const cols = [];

            const make = (elo) => {
                if (!elo) return `<span class="ebadge e-no">----</span>`;
                return `
                    <span class="ebadge ${eloClass(elo)}">
                        ${Math.round(elo.elo)}
                    </span>
                `;
            };

            cols.push(make(getElo(player)));

            st.matchTypes
                .filter(mt =>
                    mt.elo_eligible &&
                    mt.match_type !== primaryMatchType
                )
                .forEach(mt => {
                    cols.push(make(getElo(player, mt.match_type)));
                });

            return cols.join('');
        };

        this.listEl.innerHTML =
            header +
            rankedPlayers
                .map((player, index) => `
                    <div class="elo-row">
                        <div class="elo-rank">#${index + 1}</div>
                        <div class="avatar" style="margin-left:8px">
                            ${player.initials ?? '?'}
                        </div>
                        
                            <div class="elo-name">
                                ${player.nickname ?? gettext('Onbekend')}
                            </div>
                        
                        ${renderBadges(player)}
                    </div>
                `)
                .join('');
    }
}

// ─── Instances ────────────────────────────────────────────────────────────────
const members   = new Members();
const players   = new Players();
const matchForm = new MatchForm();
const matchList = new MatchList();
const eloBoard  = new EloBoard();

const tabs = new Tabs(
    ['players', 'matches', 'elo', 'info'],
    { active: 'active', class: 'tab',  prefix: 'tab-' },
    { active: 'active', class: 'sec',  prefix: 'sec-' }
);

tabs.assignCallback('matches', () => {
    matchForm.renderTeams();
    matchForm.renderTime();
    matchForm.updateRankedStatus();
});
tabs.assignCallback('elo', () => eloBoard.load());

const info = new Tabs(
    ['usage', 'rules', 'technique', 'strategy', 'elo'],
    { active: 'on',     class: 'pill', prefix: 'info-' },
    { active: 'active', class: 'tert', prefix: 'tert-' }
);

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init() {
    // Load match types first so ranked eligibility checks work immediately
    try {
        st.matchTypes = await api('GET', 'match-types/');
    } catch {
        console.warn('Could not load match types — ranked eligibility checks will default to false.');
    }
    await players.load();
    await matchList.load();
})();