const SUPABASE_URL = "https://xytutxpspgehfizkiyrp.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_pP1Sbx1kjFpcx06QzHADeg_4ncI7_W2"

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const playersBody = document.getElementById('playersBody')
const playerForm = document.getElementById('playerForm')


document.addEventListener('DOMContentLoaded', () => loadPlayers('last_name'))


async function updateElo(player_id){
  let { data: player_data, error: error_match } = (await supabase
      .from('players')
      .select("id").
      order("allmatches_n", { ascending: false }));

  if (error_match) {
    console.error(`Error getting match data:\n${error_match}`)
  } else {
    console.log(player_data)
  }
  // let { player_data, error } = await supabase
  //     .from('players')
  //     .select('')

}

async function loadPlayers(order_column = "id") {
  const { data: dataPlayers, error: error_players } = (await supabase
    .from('players')
    .select('*')
    .order("all_matches_n", { ascending: false }))
  const { data: data_elo, error: error_elo } = await supabase
    .from('elos')
    .select('player_id, elo_1v1, elo_2v2, n_matches_1v1, n_matches_2v2')
    .order('elo_2v2', { ascending: false });

  if (error_players) {
    console.error('Error loading players:', error_players)
    return
  } else if (error_elo) {
    console.error('Error loading elo:', error_elo)
    return
  } else {
    console.log(data_elo)
    console.error(error_elo)
  }

  // Clear the table body
  playersBody.innerHTML = '';
  let playerId;
  // Add a row for each player
  dataPlayers.forEach(player => {
    const row = document.createElement('tr');
    playerId = dataPlayers['']
    row.innerHTML = `
      <td class="table-fn">${player.first_name ?? ''}</td>
      <td class="table-ln">${player.interject ?? ''} ${player.last_name}</td>
      <td class="table-elo1">${data_elo[playerId][] ?? '-'}</td>
      <td class="table-elo2">${player['2v2elo'] ?? '-'}</td>
      <td class="table-jaargroep">${player.jaargroep ?? ''}</td>
    `
    playersBody.appendChild(row)
  });
}

// 🧾 Handle form submission
playerForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const first_name = document.getElementById('first_name').value.trim()
  const interject = document.getElementById('interject').value.trim()
  const last_name = document.getElementById('last_name').value.trim()
  const jaargroep = document.getElementById('jaargroep').value.trim()


  // Insert player
  const { error } = await supabase.from('players').insert([
    {
      first_name,
      interject,
      last_name,
      jaargroep
    }
  ])

  if (error) {
    console.error('Error adding player:', error)
    alert('Fout bij toevoegen speler: ' + error.message)
    return
  }

  // Clear form and reload table
  playerForm.reset()
  await loadPlayers()
})