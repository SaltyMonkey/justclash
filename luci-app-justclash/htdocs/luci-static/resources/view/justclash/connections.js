'use strict';
'require view';

return view.extend({
    render: function () {
        const style = E('style', {}, [
            ` .flex - table {
                display: flex;
                flex- direction: column;
        width: 100 %;
        font - family: monospace;
        font - size: 12px;
        border: 1px solid #ccc;
        border - radius: 3px;
        overflow: hidden;
    }
        .flex - header, .flex - row {
            display: flex;
            padding: 2px 0;
            border- bottom: 1px solid #e0e0e0;
line - height: 1.2;
            }
            .flex - header {
    font - weight: bold;
    background: #f5f5f5;
    color: #333;
}
            .flex - header > div,
            .flex - row > div {
    flex: 1;
    padding: 0 4px;
    white - space: nowrap;
    overflow: hidden;
    text - overflow: ellipsis;
}
            .flex - row: last - child {
    border - bottom: none;
}
        `]);

        const container = E('div', { class: 'cbi-section' });
        const table = E('div', { class: 'flex-table' });
        const header = E('div', { class: 'flex-header' }, [
            E('div', {}, _('IP')),
            E('div', {}, _('Порт')),
            E('div', {}, _('Протокол')),
            E('div', {}, _('Статус'))
        ]);
        table.appendChild(header);
        container.appendChild(style);
        container.appendChild(E('h2', {}, _('Соединения (с буфером и throttle)')));
        container.appendChild(table);

        // --- Хранилище строк DOM ---
        const rowMap = new Map();

        // --- Буфер данных и флаг изменений ---
        const dataBuffer = new Map();
        let changed = false;

        function getKey(entry) {
            return `${ entry.ip }:${ entry.port }`;
        }

        // Обновление или создание строки в DOM
        function updateRow(entry) {
            const key = getKey(entry);
            let row = rowMap.get(key);

            if (!row) {
                row = E('div', { class: 'flex-row', 'data-key': key }, [
                    E('div', {}, entry.ip),
                    E('div', {}, entry.port),
                    E('div', {}, entry.proto),
                    E('div', {}, entry.status)
                ]);
                table.appendChild(row);
                rowMap.set(key, row);
            } else {
                const cells = row.childNodes;
                if (cells[2].textContent !== entry.proto) cells[2].textContent = entry.proto;
                if (cells[3].textContent !== entry.status) cells[3].textContent = entry.status;
            }
        }

        // Функция рендера из буфера
        function renderBufferedData() {
            if (!changed) return;

            changed = false;

            const seenKeys = new Set();

            for (const [key, entry] of dataBuffer.entries()) {
                seenKeys.add(key);
                updateRow(entry);
            }

            // Удаляем устаревшие строки
            for (const key of rowMap.keys()) {
                if (!seenKeys.has(key)) {
                    table.removeChild(rowMap.get(key));
                    rowMap.delete(key);
                }
            }
        }

        // WebSocket
        let ws = null;
        let reconnectTimeout = null;
        const retryDelay = 5000;

        function connectWS() {
            ws = new WebSocket('ws://192.168.1.1:8080');

            ws.onopen = () => {
                console.log('[WS] Подключено');
            };

            ws.onmessage = (event) => {
                try {
                    const conns = JSON.parse(event.data);
                    for (const conn of conns) {


                        const key = getKey(conn);
                        const old = dataBuffer.get(key);
                        // Проверяем есть ли изменения
                        if (!old || JSON.stringify(old) !== JSON.stringify(conn)) {
                            dataBuffer.set(key, conn);
                            changed = true;
                        }
                    }
                } catch (e) {
                    console.warn('Ошибка разбора WS данных:', e);
                }
            };

            ws.onerror = (err) => {
                console.warn('[WS] Ошибка:', err);
            };

            ws.onclose = () => {
                console.warn('[WS] Отключено. Переподключение через 5 секунд...');
                scheduleReconnect();
            };
        }

        function scheduleReconnect() {
            if (!reconnectTimeout) {
                reconnectTimeout = setTimeout(() => {
                    reconnectTimeout = null;
                    connectWS();
                }, retryDelay);
            }
        }

        connectWS();

        // Запускаем периодический рендер раз в 200 мс
        setInterval(renderBufferedData, 200);

        return container;
    }
});