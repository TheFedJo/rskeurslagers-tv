/* global st, api, toast, gettext, members, playerInitials */

class Players {
  constructor() {
    this.listEl = document.getElementById('player-list')
    this.countEl = document.getElementById('players-statistic')
  }

  async load() {
    try {
      st.players = await api('GET', 'players/')
      this.render()
      this.countEl.textContent = st.players.length
    } catch {
      toast(gettext('Spelers laden mislukt'), 'err')
    }
  }

  async create() {
    const m = st.selMember
    if (!m) {
      toast(gettext('Kies eerst een lid'), 'err')
      return
    }

    if (st.players.some((p) => p.member?.id === m.id)) {
      members.createHint.textContent = gettext('Lid is al als speler toegevoegd.')
      return
    }

    const nickname = members.nicknameInput.value.trim()
    if (nickname.length < 4) {
      toast(gettext('Nickname te kort'), 'err')
      return
    }

    try {
      const player = await api('POST', 'players/', {
        member_id: m.id,
        nickname
      })
      st.players.push(player)
      members.clearSelection()
      this.render()
      this.countEl.textContent = st.players.length.toString()
      toast(`${player.member?.display_name ?? nickname} ${gettext('als speler toegevoegd')}`)
    } catch (err) {
      const msg = err?.member?.[0] ?? err?.non_field_errors?.[0] ??
        gettext('Speler aanmaken mislukt')
      toast(msg, 'err')
      members.createHint.textContent = msg
    }
  }

  render() {
    if (!st.players.length) {
      this.listEl.innerHTML = `<div class="empty">${gettext('Nog geen spelers.')}</div>`
      return
    }
    this.listEl.innerHTML = st.players.map((p) => {
      const ini = playerInitials(p)
      const dname = p.member?.display_name ?? p.member?.name ?? 'Unknown'
      const gen = p.member?.generation?.name ?? ''
      return `
                <div class="player-row">
                    <div class="avatar">${ini}</div>
                    <div class="player-info">
                        <div class="player-data">${p.nickname}</div>
                        <div class="player-metadata">${dname} · ${gen}</div>
                    </div>
                    <div class="mono player-id-text">${p.id.toString().slice(0, 8)}…</div>
                </div>`
    }).join('')
  }
}
