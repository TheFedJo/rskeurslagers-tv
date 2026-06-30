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

        if (!st.elo.filter(elo => elo.match_type.match_type === primaryMatchType).length && !(st.eloFilter === 'all')) {
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
                            ${playerInitials(player)}
                        </div>
                        
                            <div class="elo-name" title="${player.member.display_name}">
                                ${player.nickname ?? gettext('Onbekend')}
                            </div>
                        
                        ${renderBadges(player)}
                    </div>
                `)
                .join('');
    }
}
