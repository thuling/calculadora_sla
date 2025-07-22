let feriados = [];

// --- FUNÇÕES AUXILIARES ---

/**
 * Carrega feriados do arquivo feriado.txt.
 * O arquivo deve estar na raiz do projeto.
 */
async function carregarFeriados() {
    try {
        const response = await fetch('../feriado.txt');
        if (!response.ok) {
            console.error("Arquivo feriado.txt não encontrado na raiz do projeto.");
            return;
        }
        const text = await response.text();
        feriados = text.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => {
                const [d, m, y] = line.split('/');
                return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; // Formato YYYY-MM-DD
            });
    } catch (error) {
        console.error("Erro ao carregar o arquivo de feriados:", error);
        document.getElementById('resultadoLeadTime').innerHTML = `<p class="error-msg">Não foi possível carregar feriados.</p>`;
    }
}

/**
 * Converte string "dd/mm/aaaa HH:MM:SS" para um objeto Date.
 */
function parseDateTime(dateTimeStr) {
    const parts = dateTimeStr.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const [day, month, year] = parts[0].split('/');
    const [hour, minute, second] = parts[1].split(':');
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (isNaN(date.getTime())) return null;
    return date;
}

/**
 * Verifica se a data é um dia útil (não é fim de semana nem feriado).
 */
function isWorkday(dt) {
    const dayOfWeek = dt.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    const dateStr = dt.toISOString().split('T')[0];
    return !feriados.includes(dateStr);
}

/**
 * Formata um total de milissegundos em "HH:MM:SS".
 */
function formatDuration(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}


// --- FUNÇÃO PRINCIPAL DE CÁLCULO ---

function calculateLeadTime(start, end) {
    let totalMs = 0;
    let current = new Date(start);

    while (current < end) {
        if (!isWorkday(current)) {
            current.setDate(current.getDate() + 1);
            current.setHours(8, 0, 0, 0);
            continue;
        }

        const workStart = new Date(current); workStart.setHours(8, 0, 0, 0);
        const lunchStart = new Date(current); lunchStart.setHours(12, 0, 0, 0);
        const lunchEnd = new Date(current); lunchEnd.setHours(13, 0, 0, 0);
        const workEnd = new Date(current); workEnd.setHours(17, 0, 0, 0);
        
        // Ajusta o início do dia para o começo do expediente
        if (current < workStart) {
            current = workStart;
        }
        
        const endOfDay = (current.toDateString() === end.toDateString()) ? end : workEnd;
        
        let dayMs = 0;
        
        const periodStart = new Date(current);
        const periodEnd = (endOfDay < workEnd) ? endOfDay : workEnd;
        
        if (periodStart < periodEnd) {
             // Período da manhã
            const morningStart = new Date(periodStart);
            const morningEnd = (periodEnd < lunchStart) ? periodEnd : lunchStart;
            if (morningStart < morningEnd) {
                dayMs += (morningEnd - morningStart);
            }

            // Período da tarde
            const afternoonStart = (periodStart > lunchEnd) ? periodStart : lunchEnd;
            const afternoonEnd = new Date(periodEnd);
            if (afternoonStart < afternoonEnd) {
                dayMs += (afternoonEnd - afternoonStart);
            }
        }
       
        totalMs += dayMs;

        // Avança para o próximo dia útil
        current.setDate(current.getDate() + 1);
        current.setHours(8, 0, 0, 0);
    }
    
    return totalMs;
}


// --- EVENT LISTENER E EXECUÇÃO ---

document.getElementById('calcularLeadTimeBtn').addEventListener('click', async () => {
    await carregarFeriados();

    const inicioStr = document.getElementById('dataInicio').value;
    const fimStr = document.getElementById('dataFim').value;
    const resultadoDiv = document.getElementById('resultadoLeadTime');

    const dataInicio = parseDateTime(inicioStr);
    const dataFim = parseDateTime(fimStr);

    if (!dataInicio || !dataFim) {
        resultadoDiv.innerHTML = `<p class="error-msg">Datas inválidas. Use o formato dd/mm/aaaa HH:MM:SS.</p>`;
        return;
    }
    
    if (dataInicio >= dataFim) {
        resultadoDiv.innerHTML = `<p class="error-msg">A data de início deve ser anterior à data de fim.</p>`;
        return;
    }
    
    const leadTimeMs = calculateLeadTime(dataInicio, dataFim);
    resultadoDiv.innerHTML = `<div class="item-sla"><p><strong>Lead Time Útil:</strong> ${formatDuration(leadTimeMs)}</p></div>`;
});