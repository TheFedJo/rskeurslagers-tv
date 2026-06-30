
const playersList = document.getElementById('playersList')


// Load autocomplete data
document.addEventListener('DOMContentLoaded', loadPlayerNames)

async function loadPlayerNames() {
  const { data, error } = await supabase
    .from('players')
    .select('first_name, last_name, interject', 'id')

  if (error) {
    console.error('Error loading players:', error)
    return
  }

  // Clear old suggestions
  playersList.innerHTML = ''

  // Create one <option> per player
  data.forEach(p => {
    const name = [p.first_name, p.interject, p.last_name].filter(Boolean).join(' ')
    const option = document.createElement('option')
    option.value = name
    option.id = p.id
    playersList.appendChild(option)
  })
}

// Optional: refresh list dynamically when typing (throttled)
const playerInputs = document.getElementsByClassName('player-input')
let timeout
for (const playerInput of playerInputs) {
  playerInput.addEventListener('input', () => {
  clearTimeout(timeout)
  timeout = setTimeout(loadPlayerNames, 1000)
})
}