let feriados = [];
let chartU_instance = null;
let chartN_instance = null;

// --- FUNÇÕES AUXILIARES (sem alterações) ---
async function carregarFeriados() {
    if (feriados.length > 0) return;
    try {
        const response = await fetch('./feriado.txt');
        if (!response.ok) throw new Error(`Ficheiro 'feriado.txt' não encontrado.`);
        const text = await response.text();
        feriados = text.split('\n').map(line => line.trim()).filter(line => line).map(line => {
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
    const hour = timeParts[0] || '00', minute = timeParts[1] || '00', second = timeParts[2] || '00';
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (isNaN(date.getTime()) || date.getDate() != day || date.getMonth() != month - 1) return null;
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
        while (!isWorkday(current)) current.setDate(current.getDate() + 1);
    }
    return totalMs;
}

// --- FUNÇÃO PARA RENDERIZAR GRÁFICOS (TIPO = PIE) ---
function renderChart(chartId, chartInstance, labels, data) {
    const ctx = document.getElementById(chartId).getContext('2d');
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    Chart.register(ChartDataLabels);

    return new Chart(ctx, {
        type: 'pie', // <-- ALTERADO DE VOLTA PARA 'PIE'
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderColor: '#ffffff',
                borderWidth: 4,
                hoverBorderColor: '#f4f7f9'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 15,
                        padding: 20,
                        font: { size: 14 }
                    }
                },
                tooltip: { enabled: false },
                datalabels: {
                    formatter: (value, ctx) => {
                        const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        const percentage = total > 0 ? (value / total * 100).toFixed(1) + '%' : '0%';
                        if (value === 0) return '';
                        return percentage;
                    },
                    color: '#fff',
                    font: {
                        weight: 'bold',
                        size: 16,
                    }
                }
            }
        }
    });
}

// --- EVENT LISTENER PRINCIPAL (sem alterações) ---
document.getElementById('verificarLeadTimeSlaBtn').addEventListener('click', async () => {
    const resultadoDiv = document.getElementById('resultadoLeadTime');
    const analysisWrapper = document.getElementById('analysis-wrapper');
    resultadoDiv.innerHTML = '';
    analysisWrapper.style.display = 'none';

    try {
        await carregarFeriados();
        
        const listaInicioEl = document.getElementById('listaInicio'),
              listaFimEl = document.getElementById('listaFim'),
              listaPrioridadeEl = document.getElementById('listaPrioridade');

        if (!listaInicioEl || !listaFimEl || !listaPrioridadeEl) {
            throw new Error("Erro de programação: Elementos não encontrados.");
        }

        const listaInicio = listaInicioEl.value.trim().split('\n'),
              listaFim = listaFimEl.value.trim().split('\n'),
              listaPrioridade = listaPrioridadeEl.value.trim().split('\n');

        if (listaInicio.length !== listaFim.length || listaInicio.length !== listaPrioridade.length || (listaInicio.length === 1 && listaInicio[0] === '')) {
            throw new Error("As três colunas devem ter o mesmo número de linhas e não podem estar vazias.");
        }
        
        let slaData = {
            U: { tempos: [], dentro: 0, fora: 0 },
            N: { tempos: [], dentro: 0, fora: 0 }
        };
        let hasValidResults = false;

        for (let i = 0; i < listaInicio.length; i++) {
            const dataInicio = parseDateTime(listaInicio[i]),
                  dataFim = parseDateTime(listaFim[i]),
                  prioridade = listaPrioridade[i].trim().toUpperCase();

            if (!dataInicio || !dataFim || !prioridade) {
                resultadoDiv.innerHTML += `<p class="error-msg">Erro na linha ${i + 1}: Dados inválidos ou em falta.</p>`;
                continue;
            }

            let slaHoras = 0;
            if (prioridade === 'N') slaHoras = 16;
            else if (prioridade === 'U') slaHoras = 6;
            else {
                 resultadoDiv.innerHTML += `<p class="error-msg">Erro na linha ${i + 1}: Prioridade inválida. Use 'N' ou 'U'.</p>`;
                 continue;
            }
            hasValidResults = true;
            const slaMs = slaHoras * 60 * 60 * 1000;
            const tempoGastoMs = calculateTimeSpent(dataInicio, dataFim);
            const status = tempoGastoMs <= slaMs ? "Dentro do SLA" : "Fora do SLA";
            
            if (slaData[prioridade]) {
                slaData[prioridade].tempos.push(tempoGastoMs);
                if (status === "Dentro do SLA") slaData[prioridade].dentro++;
                else slaData[prioridade].fora++;
            }
            
            const statusClass = status === "Dentro do SLA" ? "status-in" : "status-out";
            resultadoDiv.innerHTML += `
                <div class="result-item">
                    <div class="item-header">
                        <strong>Item ${i + 1} (Prioridade ${prioridade})</strong>
                        <span class="status-badge ${statusClass}">${status}</span>
                    </div>
                    <div class="item-body">
                        <span>Tempo Gasto: <strong>${formatDuration(tempoGastoMs)}</strong></span>
                        <span>Meta: <strong>${String(slaHoras).padStart(2, '0')}:00:00</strong></span>
                    </div>
                </div>
            `;
        }
        
        if (hasValidResults) {
            analysisWrapper.style.display = 'block';

            const mediaU_Ms = slaData.U.tempos.length > 0 ? slaData.U.tempos.reduce((a, b) => a + b, 0) / slaData.U.tempos.length : 0;
            const mediaN_Ms = slaData.N.tempos.length > 0 ? slaData.N.tempos.reduce((a, b) => a + b, 0) / slaData.N.tempos.length : 0;
            document.getElementById('mediaU').textContent = formatDuration(mediaU_Ms);
            document.getElementById('mediaN').textContent = formatDuration(mediaN_Ms);

            chartU_instance = renderChart('chartU', chartU_instance, ['Dentro do SLA', 'Fora do SLA'], [slaData.U.dentro, slaData.U.fora]);
            chartN_instance = renderChart('chartN', chartN_instance, ['Dentro do SLA', 'Fora do SLA'], [slaData.N.dentro, slaData.N.fora]);
        }

    } catch (error) {
        resultadoDiv.innerHTML = `<p class="error-msg">${error.message}</p>`;
        analysisWrapper.style.display = 'none';
    }
});