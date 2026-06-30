
const jaargroepList = document.getElementById('jaargroepList')


// Load autocomplete data
document.addEventListener('DOMContentLoaded', loadJaargroepen)

async function loadJaargroepen() {
  const { data, error } = await supabase
    .from('jaargroepen')
    .select('jaargroep')

  if (error) {
    console.error('Error loading jaargroepen:', error)
    return
  }

  // Clear old suggestions
  jaargroepList.innerHTML = ''

  // Create one <option> per player
  data.forEach(p => {
    const option = document.createElement('option')
    option.value = p.jaargroep
    jaargroepList.appendChild(option)
  })
}
