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
