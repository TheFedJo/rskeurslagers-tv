
class MatchForm {
    constructor() {
        this.liveButton     = document.getElementById('live-score-button')
        this.sc1            = document.getElementById('sc1');
        this.sc2            = document.getElementById('sc2');
        this.dtInput        = document.getElementById('date-time-played');
        this.teamWrap       = document.getElementById('team-wrap');
        this.submitBtn      = document.getElementById('match-submit-btn');
        this.rankedToggle   = document.getElementById('ranked-toggle');
        this.rankedHint     = document.getElementById('ranked-hint');

        // Initialize live counter
        this.liveCounter = new LiveScoreCounter(this.sc1, this.sc2);

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
            this._setHint(gettext('Geen score ingevuld'), '');
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
                this._setHint(gettext('Wedstrijd komt in aanmerking voor klassement ✓'), 'eligible');
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
        this.liveCounter.clearTeamNames();
        if (!st.players.length) {
            this.teamWrap.innerHTML =
                `<div class="warning-text">${gettext('Voeg eerst spelers toe.')}</div>`;
            return;
        }

        const [t1c, t2c] = teamCounts(st.matchType);
        const buildTeam  = (label, count, prefix) => {
            const col    = document.createElement('div');
            for (let i = 0; i < count; i++) {
                const id = `${prefix}${i}`;

                col.insertAdjacentHTML(
                    'beforeend',
                    this.playerSelectHTML(id)
                );

                const playerSelect = col.querySelector(`#${id}`);

                playerSelect.addEventListener('change', (event) => {
                    this.liveCounter.updateTeamNames(event.target, id);
                });
            }
            return col;
        };

        this.teamWrap.innerHTML = '';
        this.teamWrap.appendChild(buildTeam('Team 1', t1c, 't1p'));

        const div = document.createElement('div');
        div.classList.add('team-divider');
        this.teamWrap.appendChild(div)

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

        // Turn off live counter when editing
        if (this.liveCounter.isActive) {
            this.liveCounter.toggle();
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

        // Turn off live counter on reset
        if (this.liveCounter.isActive) {
            this.liveCounter.toggle();
        }

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