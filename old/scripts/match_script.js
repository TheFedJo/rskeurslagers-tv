const SUPABASE_URL = "https://xytutxpspgehfizkiyrp.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_pP1Sbx1kjFpcx06QzHADeg_4ncI7_W2"

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const matchForm = document.getElementById("matchForm")
const matchesBody = document.getElementById("matchesBody")
const score_t1 = document.getElementById("score_t1")
const score_t2 = document.getElementById("score_t2")
const resultText = document.getElementById("score-result")

const TPC = parseInt(document.getElementById("player_count_match").innerHTML) // player count per team
console.log(`Team player count ${TPC}`)
// Load matches when the page loads
document.addEventListener("DOMContentLoaded", () => loadMatches(TPC))



async function loadPlayerData() {
  const { data, error } = (await supabase
      .from('players')
      .select("*").
      order("last_name", { ascending: false }));
  if (error) {
    console.error("Error loading players:", error)
    return
  }
  return data
}

const playerData =  loadPlayerData()

async function playerLists() {
  let pd = await playerData
  let player_id_list = new Map();
  let list_id_player = new Map();
  pd.forEach(player => {
    let name = player["first_name"] + " " +
           (player["interject"] ? player["interject"] + " " : "") +
           player["last_name"]
    player_id_list.set(name, parseInt(player["id"]))
    list_id_player.set(parseInt(player["id"]), name)
  })
  return [player_id_list, list_id_player]
}


function htmlRow(players, match, lp) {
  let getName = id => lp.get(id)
  let playersRow = "";

  if (players === 2) {
    playersRow = `
      <td class="table-player11">${getName(match.t1_p1)}</td>
      <td class="table-player12">${getName(match.t1_p2)}</td>
      <td class="table-player21">${getName(match.t2_p1)}</td>
      <td class="table-player22">${getName(match.t2_p2)}</td>
    `
    // console.log(playersRow)
  } else if (players === 1) {
    playersRow = `
      <td class="table-player">${getName(match.t1_p1)}</td>
      <td class="table-player">${getName(match.t2_p1)}</td>
    `
  }
  let row = document.createElement("tr");
  let date = new Date(match.date_played)
  date = date.toLocaleDateString("nl-NL", options={
        month: "long",
        day: "numeric",
  }).substring(0, 6);
  row.innerHTML = playersRow + `
      <td class="table-score">${match.score_t1} - ${match.score_t2}</td>
      <td class="table-date">${date} </td>
    `
  // console.log(playersRow.innerHTML)
  return row
}

async function loadMatches(team_player_count) {
  if (!(team_player_count === 2 || team_player_count === 1)) {
    console.error("Deze matches houden we niet bij")
    return
  }
  let db_name = `matches${team_player_count}v${team_player_count}`;
  const { data, error } = await supabase.from(db_name).select("*").order("time_played", "date_played", {ascending: false})
  if (error) {
    console.error("Error loading matches:", error)
    return
  }
  matchesBody.innerHTML = "";

  let listIdPlayers = (await playerLists())[1]
  if (listIdPlayers === undefined) {
    console.log("Error loading player data")
    return
  }
  data.forEach(match => {
    matchesBody.appendChild(htmlRow(team_player_count, match, listIdPlayers))

  })
}

// Add a new match
matchForm.addEventListener("submit", async (e) => {
  e.preventDefault()

  let pl = await playerLists()[0]
  getPlayerId = name => pl.get(name);
  let players = ["t1_p1", "t1_p2", "t2_p1", "t2_p2"]
  players = players.map(
      (field_name) => {
        console.log(field_name)
        value = document.getElementById(field_name).value
        console.log(value)
        return [field_name, value, getPlayerId(value)]
      }
  )

  let getFieldName = a => a[0]
  let getValue = a => a[1]
  let getId = a => a[2]

  let scoreA = parseInt(score_t1.value)
  let scoreB = parseInt(score_t2.value)
  let error;
  if (scoreA < 0 || scoreB < 0) {
    error = "Scores kloppen niet, onder nul"
  } else if (!players.some(getId)) {
    error = "Sommige spelers staan niet in de database: " + players.filter(a => !getId(a)).map(getValue).toString()
  }

  if (error) {
    resultText.style.color = "red"
    resultText.innerHTML = error
    return
  }

  result = {
    "score_t1": scoreA, "score_t2": scoreB,
    "result": (scoreA > scoreB) ? "win" : ((scoreA === scoreB) ? "draw" : "loss"),
    "date_played": new Date().toISOString().slice(0, 10),
  }
  players.forEach(
      a => {result[getFieldName(a)] = getId(a)}
  )

  console.log(`Sending:\n${result.toString()}`)

  const { supabaseError } = await supabase
      .from(`matches${TPC}v${TPC}`)
      .insert([result])

  if (supabaseError) {
    console.error("Error adding match:", error)
  } else {
    matchForm.reset()
    loadMatches(TPC)
  }
})


async function scoreParse() {
  const scoreA = parseInt(score_t1.value)
  const scoreB = parseInt(score_t2.value)
  let display_text;
  if (isNaN(scoreA) || isNaN(scoreB)) {
    display_text = ""
  } else if (scoreA === scoreB) {
    display_text = "Gelijkspel????"
  } else if (scoreA > scoreB) {
    if (scoreA >= scoreB + 10) {
      display_text = "Team 2 mag onder de tafel door. Kruipen!"
    } else {
      display_text = "Team 1 wint!"
    }
  } else {
    if (scoreB >= scoreA + 10) {
      display_text = "Team 1 mag onder de tafel door. Kruipen!"
    } else {
      display_text = "Team 2 wint!"
    }

  }
  resultText.innerHTML = display_text
}

scoreParse()
score_t1.addEventListener("change", scoreParse)
score_t2.addEventListener("change", scoreParse)


