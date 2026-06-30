let members;
let players;
let matchForm;
let matchList;
let eloBoard;
let tabs;
let info;

document.addEventListener('DOMContentLoaded', () => {
    // ─── Instances ────────────────────────────────────────────────────────────────
    members   = new Members();
    players   = new Players();
    matchForm = new MatchForm();
    matchList = new MatchList();
    eloBoard  = new EloBoard();

    tabs = new Tabs(
        ['players', 'matches', 'elo', 'info'],
        { active: 'active', class: 'tab',  prefix: 'tab-' },
        { active: 'active', class: 'sec',  prefix: 'sec-' }
    );

    tabs.assignCallback('matches', async () => {
        matchForm.renderTime();
        await players.load();
        matchForm.renderTeams();
        matchForm.updateRankedStatus();
    });
    tabs.assignCallback('elo', () => eloBoard.load());

    info = new Tabs(
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
        toast('Alles geladen', 'ok')
    })();
})
