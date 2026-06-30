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

            return `
                <div class="match-row${m.ranked ? ' match-ranked' : ''}" id="mrow-${m.id}">
                    <div class="match-info">
                        ${this.renderTopRow(m)}
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

    renderTopRow(m) {
        const rankedBadge = m.ranked
            ? `<span class="ranked-badge" title="${gettext('Klassementswedstrijd')}">Klassement</span>`
            : `<span class="unranked-badge" title="${gettext('Vriendschappelijke wedstrijd')}">Vriendschappelijk</span>`;

        return `<div className="match-top-row">
            ${m.match_type} — ${m.score_team_1} : ${m.score_team_2} — ${rankedBadge}
        </div>`;
    }

    renderParticipants(participants, results) {
        const renderOne = (side, p) => {
            const gain = (p.elo_gain > 0 ? '+' : '') + p.elo_gain.toFixed(0);
            return `<div class="participant ${side}" title="${p.display_name}">
                ${side === "right" ? `<span class="elo-gain">${gain}</span>` : p.nickname}
                ${side === "left" ? `<span class="elo-gain">${gain}</span>` : p.nickname}
            </div>`;
        };
        const ps1 = participants.filter((p) => p.team === 1).map(
            p => renderOne("left", p)
        ).join('');
        const ps2 = participants.filter((p) => p.team === 2).map(
            p => renderOne("right", p)
        ).join('');
        return `
            <span class="participants-wrapper">
                <div class="participants left ${results[0]} ">${ps1}</div>
                <div class="participants right ${results[1]}">${ps2}</div>
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
