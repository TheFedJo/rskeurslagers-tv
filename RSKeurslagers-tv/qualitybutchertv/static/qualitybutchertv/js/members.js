class Members {
  constructor() {
    this.searchTimer = null
    this.searchBar = document.getElementById('member-search')
    this.searchWrapper = document.getElementById('member-search-wrap')
    this.nicknameInput = document.getElementById('nickname-input')
    this.selectedCard = document.getElementById('selected-member-card')
    this.createBtnWrap = document.getElementById('create-btn-wrap')
    this.createHint = document.getElementById('create-hint')
    this.dropdown = document.getElementById('member-dd')
    this.selectedAvatar = document.getElementById('sel-avatar')
    this.selectedName = document.getElementById('sel-name')
    this.selectedMeta = document.getElementById('sel-meta')
    this.selectedStatus = document.getElementById('sel-status-tag')

    document.addEventListener('click', (e) => {
      if (!this.searchWrapper.contains(e.target)) {
        this.dropdown.style.display = 'none'
      }
    })
  }

  filter() {
    clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(async() => {
      const q = this.searchBar.value.trim()
      if (q.length < 2) {
        this.dropdown.style.display = 'none'
        return
      }
      try {
        const results = await api('GET', `members/?search=${encodeURIComponent(q)}`)
        this.showDropdown(results)
      } catch {
        toast(gettext('Leden zoeken mislukt'), 'err')
      }
    }, 300)
  }

  showDropdown(members = []) {
    const playerMemberIds = new Set(st.players.map((p) => p.member?.id))

    if (!members.length) {
      this.dropdown.innerHTML =
        `<div class="no-items-dropdown">${gettext('Geen leden gevonden')}</div>`
      this.dropdown.style.display = 'block'
      return
    }

    this.dropdown.innerHTML = members.map((m) => {
      const isPlayer = playerMemberIds.has(m.id)
      const tag = isPlayer
        ? `<span class="tag tag-exists">${gettext('speler')}</span>`
        : `<span class="tag tag-new">${gettext('beschikbaar')}</span>`
      const encoded = encodeURIComponent(JSON.stringify(m))
      return `<div class="dd-item" data-member="${encoded}">
                <div>
                    <div class="dd-name">${m.display_name}</div>
                    <div class="dd-gen">${m.generation?.name ?? ''}</div>
                </div>
                ${tag}
            </div>`
    }).join('')

    this.dropdown.querySelectorAll('.dd-item').forEach((el) => {
      el.addEventListener('click', () => {
        const m = JSON.parse(decodeURIComponent(el.dataset.member))
        this.select(m)
      })
    })

    this.dropdown.style.display = 'block'
  }

  select(m) {
    if (!m) return
    st.selMember = m

    this.searchBar.value = m.display_name
    this.dropdown.style.display = 'none'

    const isPlayer = st.players.some((p) => p.member?.id === m.id)
    this.selectedAvatar.textContent = m.display_name.substring(0, 2)
    this.selectedName.textContent = m.display_name
    this.selectedMeta.textContent = `${m.generation?.name ?? ''} · ${m.generation?.year ?? ''}`
    this.selectedStatus.innerHTML = isPlayer
      ? `<span class="tag tag-exists">${gettext('al een speler')}</span>`
      : `<span class="tag tag-new">${gettext('nog geen speler')}</span>`
    this.selectedCard.style.display = 'block'
    this.createBtnWrap.style.display = 'block'
    this.createHint.textContent = isPlayer
      ? gettext('Dit lid is al als speler toegevoegd.') : ''
  }

  clearSelection() {
    st.selMember = null
    this.searchBar.value = ''
    this.nicknameInput.value = ''
    this.selectedCard.style.display = 'none'
    this.createBtnWrap.style.display = 'none'
    this.createHint.textContent = '';
  }
}
