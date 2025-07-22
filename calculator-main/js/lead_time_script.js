let feriados = [];

// --- FUNÇÕES AUXILIARES (sem alterações) ---

async function carregarFeriados() {
    if (feriados.length > 0) return;
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
                return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            });
    } catch (error) {
        console.error("Erro ao carregar o arquivo de feriados:", error);
        document.getElementById('resultadoLeadTime').innerHTML = `<p class="error-msg">Não foi possível carregar feriados.</p>`;
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


// --- FUNÇÃO DE CÁLCULO DE INTERVALO (sem alterações) ---

function calculateLeadTimeInterval(start, end) {
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


// --- EVENT LISTENER PRINCIPAL (ATUALIZADO) ---

document.getElementById('calcularLeadTimeBtn').addEventListener('click', async () => {
    await carregarFeriados();
    const resultadoDiv = document.getElementById('resultadoLeadTime');
    resultadoDiv.innerHTML = ''; // Limpa resultados anteriores
    
    const activeTabName = document.querySelector('.tab-button.active').innerText;

    if (activeTabName === 'Intervalo Simples') {
        const inicioStr = document.getElementById('dataInicio').value;
        const fimStr = document.getElementById('dataFim').value;
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
        const totalLeadTimeMs = calculateLeadTimeInterval(dataInicio, dataFim);
        resultadoDiv.innerHTML = `
            <div class="item-sla">
                <p><strong>Lead Time Total Calculado:</strong> ${formatDuration(totalLeadTimeMs)}</p>
            </div>`;

    } else if (activeTabName === 'Múltiplos Pares') {
        const listaInicioStr = document.getElementById('listaInicio').value.trim().split('\n');
        const listaFimStr = document.getElementById('listaFim').value.trim().split('\n');

        // Validação para garantir que as listas não estejam vazias e tenham o mesmo tamanho
        if (listaInicioStr.length !== listaFimStr.length || (listaInicioStr.length === 1 && listaInicioStr[0] === '')) {
            resultadoDiv.innerHTML = `<p class="error-msg">O número de datas de início e fim deve ser o mesmo e não pode estar vazio.</p>`;
            return;
        }

        // Itera sobre cada par de datas
        for (let i = 0; i < listaInicioStr.length; i++) {
            const dataInicio = parseDateTime(listaInicioStr[i]);
            const dataFim = parseDateTime(listaFimStr[i]);

            // Valida cada linha individualmente
            if (!dataInicio || !dataFim) {
                resultadoDiv.innerHTML += `<p class="error-msg">Erro na linha ${i + 1}: Formato de data inválido.</p>`;
                continue; // Pula para o próximo par
            }
            if (dataInicio >= dataFim) {
                resultadoDiv.innerHTML += `<p class="error-msg">Erro na linha ${i + 1}: A data de início deve ser anterior à de fim.</p>`;
                continue; // Pula para o próximo par
            }
            
            // Calcula o lead time para o par atual
            const leadTimeMs = calculateLeadTimeInterval(dataInicio, dataFim);
            
            // Exibe o resultado individual para este par
            resultadoDiv.innerHTML += `
                <div class="item-sla" style="margin-bottom: 10px;">
                    <p><strong>Item ${i + 1} - Lead Time:</strong> ${formatDuration(leadTimeMs)}</p>
                </div>
            `;
        }
    }
});