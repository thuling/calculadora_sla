let feriadosSla = [];

// --- FUNÇÕES AUXILIARES ---

async function carregarFeriadosSLA() {
    if (feriadosSla.length > 0) return;
    try {
        const response = await fetch('./feriado.txt');
        if (!response.ok) {
            throw new Error(`Ficheiro 'feriado.txt' não encontrado. Verifique se o ficheiro está na mesma pasta que o seu index.html.`);
        }
        const text = await response.text();
        feriadosSla = text.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => {
                const [d, m, y] = line.split('/');
                return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            });
    } catch (error) {
        console.error("Erro detalhado ao carregar feriados:", error);
        throw error;
    }
}

function parseDateTimeSLA(dateTimeStr) {
    const parts = dateTimeStr.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const [day, month, year] = parts[0].split('/');
    const timeParts = parts[1].split(':');
    const hour = timeParts[0] || '00';
    const minute = timeParts[1] || '00';
    const second = timeParts[2] || '00';
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (isNaN(date.getTime()) || date.getDate() != day || date.getMonth() != month - 1) {
        return null;
    }
    return date;
}

function isWorkdaySLA(dt) {
    const dayOfWeek = dt.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    const dateStr = dt.toISOString().split('T')[0];
    return !feriadosSla.includes(dateStr);
}

function formatDurationSLA(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// --- FUNÇÃO DE CÁLCULO DE TEMPO ÚTIL ---

function calculateTimeSpent(start, end) {
    let totalMs = 0;
    let current = new Date(start);
    while (!isWorkdaySLA(current) || current.getHours() >= 17) {
        current.setDate(current.getDate() + 1);
        current.setHours(8, 0, 0, 0);
    }
    if (current.getHours() < 8) current.setHours(8, 0, 0, 0);
    if (current.getHours() >= 12 && current.getHours() < 13) current.setHours(13, 0, 0, 0);
    if (current >= end) return 0;
    while (current < end) {
        const workEnd = new Date(current); workEnd.setHours(17, 0, 0, 0);
        const lunchStart = new Date(current); lunchStart.setHours(12, 0, 0, 0);
        const lunchEnd = new Date(current); lunchEnd.setHours(13, 0, 0, 0);
        let endOfPeriod = (end < workEnd) ? end : workEnd;
        if (current < lunchStart) {
            let morningEnd = (endOfPeriod < lunchStart) ? endOfPeriod : lunchStart;
            totalMs += (morningEnd - current);
        }
        if (endOfPeriod > lunchEnd) {
            let afternoonStart = (current > lunchEnd) ? current : lunchEnd;
            totalMs += (endOfPeriod - afternoonStart);
        }
        current.setDate(current.getDate() + 1);
        current.setHours(8, 0, 0, 0);
        while (!isWorkdaySLA(current)) {
            current.setDate(current.getDate() + 1);
        }
    }
    return totalMs;
}

// --- EVENT LISTENER PRINCIPAL (LÓGICA UNIFICADA) ---

document.getElementById('verificarSlaBtn').addEventListener('click', async () => {
    const resultadoDiv = document.getElementById('resultadoSLA');
    resultadoDiv.innerHTML = '';

    try {
        await carregarFeriadosSLA();

        const cliente = document.getElementById('cliente').value;
        const listaInicio = document.getElementById('listaInicioSLA').value.trim().split('\n');
        const listaFim = document.getElementById('listaFimSLA').value.trim().split('\n');
        const listaPrioridade = document.getElementById('listaPrioridadeSLA').value.trim().split('\n');

        if ((listaInicio.length !== listaFim.length) || (listaInicio.length === 1 && listaInicio[0] === '')) {
             throw new Error("As colunas de Início e Fim devem ter o mesmo número de linhas e não podem estar vazias.");
        }
        
        // Validação da coluna de prioridades APENAS se for "Outro" cliente
        if (cliente === 'OUTRO' && (listaInicio.length !== listaPrioridade.length || (listaPrioridade.length === 1 && listaPrioridade[0] === ''))) {
             throw new Error(`Para o cliente "Outro", a coluna de Prioridades deve ter o mesmo número de linhas que as de Início e Fim.`);
        }


        for (let i = 0; i < listaInicio.length; i++) {
            const dataInicio = parseDateTimeSLA(listaInicio[i]);
            const dataFim = parseDateTimeSLA(listaFim[i]);

            if (!dataInicio || !dataFim) {
                resultadoDiv.innerHTML += `<p class="error-msg">Erro na linha ${i + 1}: Formato de data inválido.</p>`;
                continue;
            }

            let slaHoras = 0;
            const prioridade = listaPrioridade[i] ? listaPrioridade[i].trim().toUpperCase() : 'N'; // Padrão 'N' se vazio

            // Lógica de SLA
            switch (cliente) {
                case 'BK':
                    // A regra original do BK era em dias, vamos assumir um equivalente em horas (3 dias * 8h/dia = 24h)
                    slaHoras = 24; 
                    break;
                case 'RENOVA':
                    slaHoras = 6;
                    break;
                case 'MOBI':
                    slaHoras = (prioridade === 'U') ? 4 : 24;
                    break;
                case 'VESUVIUS':
                    slaHoras = (prioridade === 'U') ? 4 : 8;
                    break;
                default: // 'OUTRO' ou 'AMARANTE'
                    if (prioridade === 'N') slaHoras = 16;
                    else if (prioridade === 'U') slaHoras = 6;
                    else {
                        resultadoDiv.innerHTML += `<p class="error-msg">Erro na linha ${i + 1}: Prioridade inválida. Use 'N' ou 'U'.</p>`;
                        continue;
                    }
                    break;
            }

            const slaMs = slaHoras * 60 * 60 * 1000;
            const tempoGastoMs = calculateTimeSpent(dataInicio, dataFim);
            
            const status = tempoGastoMs <= slaMs ? "Dentro do SLA" : "Fora do SLA";
            const statusColor = status === "Dentro do SLA" ? "green" : "red";

            resultadoDiv.innerHTML += `
                <div class="item-sla" style="margin-bottom: 10px; border-left: 5px solid ${statusColor};">
                    <p><strong>Item ${i + 1}</strong></p>
                    <p>Tempo Gasto: ${formatDurationSLA(tempoGastoMs)} | Meta SLA: ${String(slaHoras).padStart(2, '0')}:00:00</p>
                    <p><strong>Status: <span style="color:${statusColor};">${status}</span></strong></p>
                </div>
            `;
        }
    } catch (error) {
        resultadoDiv.innerHTML = `<p class="error-msg">${error.message}</p>`;
    }
});