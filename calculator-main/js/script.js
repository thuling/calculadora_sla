window.addEventListener("load", () => {
  setTimeout(() => {
    const telaBoasVindas = document.getElementById("tela-boas-vindas");
    const container = document.querySelector(".container");
    const titulo = document.querySelector("body > h3");
    const logo = document.querySelector("img");

    if (telaBoasVindas) telaBoasVindas.style.display = "none";
    if (container) container.style.display = "block";
    if (titulo) titulo.style.display = "block";
    if (logo) logo.style.display = "block";
  }, 3000);
});

document.querySelector("button").addEventListener("click", calcularSLAs);

function calcularSLAs() {
  const tipo = document.getElementById("tipo").value;
  const cliente = document.getElementById("cliente").value;
  const lista = document.getElementById("listaHorarios").value.trim().split("\n");
  const resultadoDiv = document.getElementById("resultado");
  resultadoDiv.innerHTML = "";

  lista.forEach((linha, index) => {
    if (linha.trim() === "") return;

    const partes = linha.trim().split(/\s+/);
    if (partes.length < 2) {
      resultadoDiv.innerHTML += `<p>Linha ${index + 1} inválida.</p>`;
      return;
    }

    const [dia, mes, ano] = partes[0].split("/");
    const [hora, minuto] = partes[1].split(":");
    const dataHora = new Date(`${ano}-${mes}-${dia}T${hora}:${minuto}:00`);

    if (isNaN(dataHora)) {
      resultadoDiv.innerHTML += `<p>Linha ${index + 1} inválida.</p>`;
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

    if (slaDiasUteis > 0) {
      let fim = new Date(dataHora);
      let diasAdicionados = 0;
      while (diasAdicionados < slaDiasUteis) {
        fim.setDate(fim.getDate() + 1);
        if (fim.getDay() !== 0 && fim.getDay() !== 6) diasAdicionados++;
      }
      fim.setHours(17, 0, 0, 0);
      resultadoDiv.innerHTML += `
        <div class="item-sla">
          <p><strong>Item ${index + 1}:</strong> Entrada: ${linha}</p>
          <p><strong>Prazo:</strong> ${fim.toLocaleString()}</p>
        </div>
      `;
      return;
    }

    const horaInicioExpediente = 8;
    const horaFimExpediente = 17;
    const duracaoAlmoco = 1; // em horas
    let restante = slaHoras;
    let dataAtual = new Date(dataHora);
    let fim = new Date(dataHora);

    while (restante > 0) {
      // Avança para o próximo dia útil se estiver fora do expediente
      if (dataAtual.getHours() >= horaFimExpediente || dataAtual.getDay() === 0 || dataAtual.getDay() === 6) {
        dataAtual.setDate(dataAtual.getDate() + 1);
        dataAtual.setHours(horaInicioExpediente, 0, 0, 0);
        continue;
      }
      
      // Ajusta para o início do expediente se chegar antes
      if (dataAtual.getHours() < horaInicioExpediente) {
        dataAtual.setHours(horaInicioExpediente, 0, 0, 0);
      }

      const inicioAlmoco = new Date(dataAtual);
      inicioAlmoco.setHours(12, 0, 0, 0);
      const fimAlmoco = new Date(dataAtual);
      fimAlmoco.setHours(13, 0, 0, 0);

      // Se o horário atual for durante o almoço, avança para o fim do almoço
      if (dataAtual >= inicioAlmoco && dataAtual < fimAlmoco) {
          dataAtual.setHours(13, 0, 0, 0);
      }

      let fimTurno = new Date(dataAtual);
      fimTurno.setHours(horaFimExpediente, 0, 0, 0);

      let tempoDisponivelNoDia = (fimTurno - dataAtual) / 3600000;

      // Desconta o almoço se o período restante no dia incluir o horário de almoço
      if (dataAtual < inicioAlmoco && fimTurno > fimAlmoco) {
          const tempoAteAlmoco = (inicioAlmoco - dataAtual) / 3600000;
          if (restante > tempoAteAlmoco) {
              tempoDisponivelNoDia -= duracaoAlmoco;
          }
      }
      
      let horasParaUsar = Math.min(restante, tempoDisponivelNoDia);
      
      let fimCalculado = new Date(dataAtual.getTime() + horasParaUsar * 3600000);

      // Adiciona a hora do almoço se o SLA passar pelo horário de almoço
      if (dataAtual < inicioAlmoco && fimCalculado >= inicioAlmoco) {
          fimCalculado.setTime(fimCalculado.getTime() + duracaoAlmoco * 3600000);
      }
      
      restante -= horasParaUsar;
      dataAtual = new Date(fimCalculado);
      fim = new Date(dataAtual);
    }

    resultadoDiv.innerHTML += `
      <div class="item-sla">
        <p><strong>Item ${index + 1}:</strong> Entrada: ${linha}</p>
        <p><strong>Prazo:</strong> ${fim.toLocaleString()}</p>
      </div>
    `;
  });
}