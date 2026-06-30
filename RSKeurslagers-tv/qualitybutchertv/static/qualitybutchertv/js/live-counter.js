class LiveScoreCounter {
    constructor(sc1, sc2) {
        this.sc1Input = sc1;
        this.sc2Input = sc2;
        this.isActive = false;

        this.ground = document.querySelector('.ground');
        this.root = document.querySelector('.root');

        // Get or create elements
        this.wrapper = document.querySelector('.live-counter-wrapper');
        this.button = document.getElementById('live-score-button');
        this.bar1 = document.getElementById('counter-team-1');
        this.bar2 = document.getElementById('counter-team-2');
        this.team1 = this.wrapper.querySelector('.live-counter-names.team-1')
        this.team2 = this.wrapper.querySelector('.live-counter-names.team-2');

        // Event listeners
        this.button.addEventListener('click', () => this.toggle());
        this.sc1Input.addEventListener('change', () => this.updateBar())
        this.sc2Input.addEventListener('change', () => this.updateBar())

        this.wrapper.addEventListener('mouseenter', () => {
            this.ground.style.overflow = 'hidden';
            this.root.style.overflow = 'hidden';
        });

        this.wrapper.addEventListener('mouseleave', () => {
            this.root.style.overflow = '';
        });
    }


    toggle() {
        this.isActive = !this.isActive;
        this.wrapper.classList.toggle('hidden');
        this.button.classList.toggle('on', this.isActive);
        this.button.classList.toggle('off', !this.isActive);

        if (this.isActive) {
            this.button.textContent = 'STOP';
            this.updateBar();
        } else {
            this.button.textContent = 'LIVE';
        }
    }

    addPoint(team) {
        if (!this.isActive) return;

        if (team === 1) {
            this.sc1Input.value = (parseInt(this.sc1Input.value) || 0) + 1;
        } else if (team === 2) {
            this.sc2Input.value = (parseInt(this.sc2Input.value) || 0) + 1;
        }

        // Trigger input event to update ranked status
        this.sc1Input.dispatchEvent(new Event('input'));
        this.updateBar();
    }

    updateBar() {
        const s1 = parseInt(this.sc1Input.value) || 0;
        const s2 = parseInt(this.sc2Input.value) || 0;
        const total = s1 + s2;

        this.bar1.style.setProperty('--q-score', s1)
        this.bar2.style.setProperty('--q-score', s2)
        this.bar1.innerHTML = s1
        this.bar2.innerHTML = s2
    }

    clearTeamNames(){
        for (let team of [1, 2]) {
            const teamContainer = team === 1 ? this.team1 : team === 2 ? this.team2 : null;
            for (let player of [0,1,2,3,4]) {
                let playerDiv = teamContainer.querySelector(`.t${team}p${player}`);
                if (playerDiv) {
                    playerDiv.parentNode.removeChild(playerDiv);
                }
            }
        }

    }

    updateTeamNames(input, t0p0) {
        const id = typeof input === "string" ? input : input.value;
        const player = st.players.find((value) => value.id === id);
        const teamNumber = parseInt(t0p0[1], 10);
        console.log(teamNumber)
        const teamContainer = teamNumber === 1
            ? this.team1
            : teamNumber === 2
                ? this.team2
                : null;

        if (!teamContainer) return;

        let playerDiv = teamContainer.querySelector(`.${t0p0}`);

        if (!playerDiv) {
            playerDiv = document.createElement("div");
            playerDiv.classList.add(t0p0);
            teamContainer.appendChild(playerDiv);
        }

        playerDiv.innerHTML = player === undefined ? "": `<div title="${player.member.display_name}">${player.nickname}</div>`;
    }
}
