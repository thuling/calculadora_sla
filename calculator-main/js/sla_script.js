document.getElementById('calcularSlaBtn').addEventListener('click', calcularSLAs);

// --- FUNÇÕES AUXILIARES ---

/**
 * Converte uma string de data "dd/mm/aaaa HH:MM" para um objeto Date.
 * @param {string} dateString - A data no formato de string.
 * @returns {Date|null} - O objeto Date ou null se for inválido.
 */
function parseDate(dateString) {
    const parts = dateString.trim().split(/\s+/);
    if (parts.length < 2) return null;

    const [day, month, year] = parts[0].split('/');
    const [hour, minute] = parts[1].split(':');
    
    // Ano, Mês (0-11), Dia, Hora, Minuto
    const date = new Date(year, month - 1, day, hour, minute);
    
    // Valida se a data criada é válida e corresponde aos valores de entrada
    if (isNaN(date.getTime()) || date.getDate() != day || date.getMonth() != month - 1) {
        return null;
    }
    return date;
}

/**
 * Verifica se um determinado dia é um dia útil (Segunda a Sexta).
 * @param {Date} date - A data para verificar.
 * @returns {boolean} - True se for um dia útil.
 */
function isWorkday(date) {
    const day = date.getDay();
    return day > 0 && day < 6; // 0 é Domingo, 6 é Sábado
}

/**
 * Adiciona o resultado formatado ao elemento na página.
 */
function displayResult(div, index, entry, deadline) {
    div.innerHTML += `
    <div class="item-sla">
      <p><strong>Item ${index + 1}:</strong> Entrada: ${entry}</p>
      <p><strong>Prazo Final:</strong> ${deadline.toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}</p>
    </div>
  `;
}


// --- FUNÇÃO PRINCIPAL ---

function calcularSLAs() {
    const tipo = document.getElementById("tipo").value;
    const cliente = document.getElementById("cliente").value;
    const listaHorarios = document.getElementById("listaHorarios").value.trim().split("\n");
    const resultadoDiv = document.getElementById("resultado");
    resultadoDiv.innerHTML = "";

    listaHorarios.forEach((linha, index) => {
        if (linha.trim() === "") return;

        const dataHora = parseDate(linha);
        if (!dataHora) {
            resultadoDiv.innerHTML += `<p class="error-msg">Linha ${index + 1}: Formato de data inválido. Use dd/mm/aaaa HH:MM.</p>`;
            return;
        }

        let slaHoras = 0;
        let slaDiasUteis = 0;

        switch (cliente) {
            case "BK":
                slaDiasUteis = tipo === "normal" ? 3 : 0;
                break;
            case "RENOVA":
                slaHoras = tipo === "normal" ? 6 : 0;
                break;
            case "MOBI":
                slaHoras = tipo === "urgente" ? 4 : 24;
                break;
            case "VESUVIUS":
                slaHoras = tipo === "urgente" ? 4 : 8;
                break;
            default:
                slaHoras = tipo === "urgente" ? 6 : 16;
        }
        
        // --- CÁLCULO DE SLA EM DIAS ÚTEIS ---
        if (slaDiasUteis > 0) {
            let prazoFinal = new Date(dataHora);
            let diasAdicionados = 0;
            while (diasAdicionados < slaDiasUteis) {
                prazoFinal.setDate(prazoFinal.getDate() + 1);
                if (isWorkday(prazoFinal)) {
                    diasAdicionados++;
                }
            }
            prazoFinal.setHours(17, 0, 0, 0);
            displayResult(resultadoDiv, index, linha, prazoFinal);
            return;
        }

        // --- CÁLCULO DE SLA EM HORAS ÚTEIS ---
        let prazoFinal = new Date(dataHora);
        let horasRestantes = slaHoras;

        // Ajusta o horário de início para estar dentro do expediente
        if (prazoFinal.getHours() >= 17 || prazoFinal.getHours() < 8 || !isWorkday(prazoFinal)) {
            if (prazoFinal.getHours() >= 17 || !isWorkday(prazoFinal)) {
                 prazoFinal.setDate(prazoFinal.getDate() + 1);
            }
            while(!isWorkday(prazoFinal)) {
                 prazoFinal.setDate(prazoFinal.getDate() + 1);
            }
            prazoFinal.setHours(8, 0, 0, 0);
        }
        
        if (prazoFinal.getHours() >= 12 && prazoFinal.getHours() < 13) {
            prazoFinal.setHours(13, 0, 0, 0);
        }

        while (horasRestantes > 0) {
            const fimDoDia = new Date(prazoFinal);
            fimDoDia.setHours(17, 0, 0, 0);

            const almocoInicio = new Date(prazoFinal);
            almocoInicio.setHours(12, 0, 0, 0);
            
            const almocoFim = new Date(prazoFinal);
            almocoFim.setHours(13, 0, 0, 0);
            
            let horasDisponiveisNoDia = 0;

            if (prazoFinal < almocoInicio) {
                horasDisponiveisNoDia = (almocoInicio - prazoFinal) / 3600000;
                if (horasRestantes <= horasDisponiveisNoDia) {
                    prazoFinal.setTime(prazoFinal.getTime() + horasRestantes * 3600000);
                    horasRestantes = 0;
                    break;
                }
                horasRestantes -= horasDisponiveisNoDia;
                prazoFinal.setHours(13,0,0,0);
            }
            
            horasDisponiveisNoDia = (fimDoDia - prazoFinal) / 3600000;
            
            if (horasRestantes <= horasDisponiveisNoDia) {
                prazoFinal.setTime(prazoFinal.getTime() + horasRestantes * 3600000);
                horasRestantes = 0;
            } else {
                horasRestantes -= horasDisponiveisNoDia;
                prazoFinal.setDate(prazoFinal.getDate() + 1);
                while(!isWorkday(prazoFinal)) {
                    prazoFinal.setDate(prazoFinal.getDate() + 1);
                }
                prazoFinal.setHours(8,0,0,0);
            }
        }
        displayResult(resultadoDiv, index, linha, prazoFinal);
    });
}