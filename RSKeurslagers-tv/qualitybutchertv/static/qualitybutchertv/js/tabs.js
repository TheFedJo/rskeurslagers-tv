class Tabs {
  constructor(tabNames, tab, sec) {
    this.tabNames = tabNames
    this.tab = tab
    this.sec = sec
    this.tabs = new Map()
    this.sections = new Map()
    this.callbacks = new Map()

    for (const tabName of tabNames) {
      const tabElement = document.getElementById(tab.prefix + tabName)
      const sectionElement = document.getElementById(sec.prefix + tabName)

      if (!tabElement) {
        throw new Error(`Tab element not found: ${tab.prefix}${tabName}`)
      }
      if (!tabElement.classList.contains(tab.class)) {
        throw new Error(`Tab element "${tab.prefix}${tabName}" must have class "${tab.class}"`)
      }
      if (!sectionElement) {
        throw new Error(`Section element not found: ${sec.prefix}${tabName}`)
      }
      if (!sectionElement.classList.contains(sec.class)) {
        throw new Error(`Section element "${sec.prefix}${tabName}" must have class "${sec.class}"`)
      }

      this.tabs.set(tabName, tabElement)
      this.sections.set(tabName, sectionElement)
    }
  }

  async go(tabName) {
    if (!this.tabs.has(tabName)) throw new Error(`Unknown tab: ${tabName}`)
    for (const [name, el] of this.tabs) {
      el.classList.toggle(this.tab.active, name === tabName)
    }
    for (const [name, el] of this.sections) {
      el.classList.toggle(this.sec.active, name === tabName)
    }
    await this.callbacks.get(tabName)?.()
  }

  assignCallback(tabName, callback) {
    this.callbacks.set(tabName, callback);
  }
}
