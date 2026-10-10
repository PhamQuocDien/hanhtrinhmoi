(() => {
    'use strict';

    function setBaseHelp() {
        const help = document.querySelector('.room-help-v10');
        if (help) help.innerHTML = '<b>Chuột trái:</b> đặt • <b>Chuột phải:</b> phá • <b>M:</b> bản đồ • <b>G:</b> đến mỏ • <b>V:</b> sinh tồn';
    }

    function selectMode(button) {
        document.querySelectorAll('.room-mode-v10 button').forEach(item => item.classList.remove('active'));
        button?.classList.add('active');
    }

    document.addEventListener('DOMContentLoaded', () => {
        const help = document.createElement('div');
        help.className = 'room-help-v10';
        document.body.append(help);
        setBaseHelp();

        const modes = document.createElement('div');
        modes.className = 'room-mode-v10';
        modes.innerHTML = [
            '<button type="button" class="active" data-room-mode="explore">🌿 Khám phá</button>',
            '<button type="button" data-room-mode="mine">⛏️ Đào quặng</button>',
            '<button type="button" data-room-mode="build">🧱 Xây dựng</button>'
        ].join('');
        document.body.append(modes);

        modes.addEventListener('click', event => {
            const button = event.target.closest('button[data-room-mode]');
            if (!button) return;
            if (window.SurvivalV11?.isActive?.()) window.SurvivalV11.leave();
            selectMode(button);
            setBaseHelp();
            if (button.dataset.roomMode === 'mine' && typeof goToInfiniteMine === 'function') goToInfiniteMine();
        });

        document.addEventListener('keydown', event => {
            if (event.code !== 'KeyG' || typeof goToInfiniteMine !== 'function') return;
            if (window.SurvivalV11?.isActive?.()) window.SurvivalV11.leave();
            selectMode(modes.querySelector('[data-room-mode="mine"]'));
            goToInfiniteMine();
        });

        window.RoomModesV10 = { selectMode, setBaseHelp };
    });
})();
