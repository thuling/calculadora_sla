let feriados = [];

// --- FUNÇÕES AUXILIARES (sem alterações) ---

async function carregarFeriados() {
    if (feriados.length > 0) return;
    try {
        const response = await fetch('./feriado.txt');
        if (!response.ok) {
            throw new Error(`Ficheiro 'feriado.txt' não encontrado. Verifique se ele está na mesma pasta que o seu index.html.`);
        }
        const text = await response.text();
        feriados = text.split('\n')
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

function parseDateTime(dateTimeStr) {
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

function isWorkday(dt) {
    const dayOfWeek = dt.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    const dateStr = dt.toISOString().split('T')[0];
    return !feriados.includes(dateStr);
}

function formatDuration(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}


// --- FUNÇÃO DE CÁLCULO DE TEMPO ÚTIL (sem alterações) ---

function calculateTimeSpent(start, end) {
    let totalMs = 0;
    let current = new Date(start);
    while (!isWorkday(current) || current.getHours() >= 17) {
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
        while (!isWorkday(current)) {
            current.setDate(current.getDate() + 1);
        }
    }
    return totalMs;
}


// --- EVENT LISTENER PRINCIPAL (LÓGICA UNIFICADA) ---

document.getElementById('verificarLeadTimeSlaBtn').addEventListener('click', async () => {
    const resultadoDiv = document.getElementById('resultadoLeadTime');
    resultadoDiv.innerHTML = '';

    try {
        await carregarFeriados();
        
        const listaInicioEl = document.getElementById('listaInicio');
        const listaFimEl = document.getElementById('listaFim');
        const listaPrioridadeEl = document.getElementById('listaPrioridade');

        if (!listaInicioEl || !listaFimEl || !listaPrioridadeEl) {
            throw new Error("Erro de programação: Um ou mais elementos não foram encontrados na página.");
        }

        const listaInicio = listaInicioEl.value.trim().split('\n');
        const listaFim = listaFimEl.value.trim().split('\n');
        const listaPrioridade = listaPrioridadeEl.value.trim().split('\n');


        if (listaInicio.length !== listaFim.length || listaInicio.length !== listaPrioridade.length || (listaInicio.length === 1 && listaInicio[0] === '')) {
            throw new Error("As três colunas devem ter o mesmo número de linhas e não podem estar vazias.");
        }

        for (let i = 0; i < listaInicio.length; i++) {
            const dataInicio = parseDateTime(listaInicio[i]);
            const dataFim = parseDateTime(listaFim[i]);
            const prioridade = listaPrioridade[i].trim().toUpperCase();

            if (!dataInicio || !dataFim || !prioridade) {
                resultadoDiv.innerHTML += `<p class="error-msg">Erro na linha ${i + 1}: Dados inválidos ou em falta.</p>`;
                continue;
            }

            let slaHoras = 0;
            if (prioridade === 'N') {
                slaHoras = 16;
            } else if (prioridade === 'U') {
                slaHoras = 6;
            } else {
                resultadoDiv.innerHTML += `<p class="error-msg">Erro na linha ${i + 1}: Prioridade inválida. Use 'N' ou 'U'.</p>`;
                continue;
            }

            const slaMs = slaHoras * 60 * 60 * 1000;
            const tempoGastoMs = calculateTimeSpent(dataInicio, dataFim);
            
            const status = tempoGastoMs <= slaMs ? "Dentro do SLA" : "Fora do SLA";
            const statusColor = status === "Dentro do SLA" ? "green" : "red";

            resultadoDiv.innerHTML += `
                <div class="item-sla" style="margin-bottom: 10px; border-left: 5px solid ${statusColor};">
                    <p><strong>Item ${i + 1}</strong></p>
                    <p>Tempo Gasto: ${formatDuration(tempoGastoMs)} | Meta SLA: ${String(slaHoras).padStart(2, '0')}:00:00</p>
                    <p><strong>Status: <span style="color:${statusColor};">${status}</span></strong></p>
                </div>
            `;
        }
    } catch (error) {
        resultadoDiv.innerHTML = `<p class="error-msg">${error.message}</p>`;
    }
});