const CONFIG_PLOT = { displayModeBar: false, responsive: true };
let painel = null;
let iniciado = false;
const estado = {
  secretaria: "",
  area: "",
  ano: 2026,
  quadrimestre: 1,
  status: "",
  metaId: "",
};

function layoutBase() {
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#e8eaed", family: "Segoe UI, sans-serif", size: 12 },
    legend: { orientation: "h", yanchor: "top", y: -0.2, x: 0, bgcolor: "rgba(0,0,0,0)" },
    margin: { l: 48, r: 16, t: 36, b: 48 },
    xaxis: { gridcolor: "#2a3344", zeroline: false, linecolor: "#2a3344" },
    yaxis: { gridcolor: "#2a3344", zeroline: false, linecolor: "#2a3344" },
  };
}

function figuraVazia(texto) {
  const layout = layoutBase();
  layout.annotations = [{ text: texto, showarrow: false, xref: "paper", yref: "paper", x: 0.5, y: 0.5 }];
  layout.xaxis = { visible: false };
  layout.yaxis = { visible: false };
  return { data: [], layout };
}

function desenhar(id, figura) {
  if (typeof Plotly === "undefined" || !document.getElementById(id)) return;
  Plotly.react(id, figura.data, figura.layout, CONFIG_PLOT);
}

function fmtNumero(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "";
  const numero = Number(valor);
  if (Number.isInteger(numero)) return String(numero);
  return numero.toFixed(4).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

function textoHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtPct(quantidade, total) {
  const percentual = total === 0 ? 0 : (100 * quantidade) / total;
  return `${percentual.toFixed(1).replace(".", ",")}%`;
}

function naturalCompare(esquerda, direita) {
  const partes = (valor) => String(valor).split(/(\d+)/).map((parte) => (/^\d+$/.test(parte) ? Number(parte) : parte));
  const a = partes(esquerda);
  const b = partes(direita);
  const limite = Math.max(a.length, b.length);
  for (let indice = 0; indice < limite; indice += 1) {
    if (a[indice] === undefined) return -1;
    if (b[indice] === undefined) return 1;
    if (a[indice] === b[indice]) continue;
    if (typeof a[indice] === "number" && typeof b[indice] === "number") return a[indice] - b[indice];
    return String(a[indice]) < String(b[indice]) ? -1 : 1;
  }
  return 0;
}

function preencherSelect(id, opcoes, valor) {
  const select = document.getElementById(id);
  select.innerHTML = "";
  opcoes.forEach((opcao) => {
    const item = document.createElement("option");
    item.value = opcao.value;
    item.textContent = opcao.label;
    select.appendChild(item);
  });
  select.value = valor;
}

function metasPorOrgao() {
  return painel.metas
    .filter((meta) => {
      if (estado.secretaria && meta.secretaria !== estado.secretaria) return false;
      if (estado.area && meta.area !== estado.area) return false;
      return true;
    })
    .sort((a, b) => naturalCompare(a.id, b.id));
}

function resultadosDoOrgao(ano, quadrimestre) {
  const ids = new Set(metasPorOrgao().map((meta) => meta.id));
  return painel.resultados.filter((linha) => {
    if (!ids.has(linha.id)) return false;
    if (ano != null && linha.ano !== Number(ano)) return false;
    if (quadrimestre != null && linha.quadrimestre !== Number(quadrimestre)) return false;
    return true;
  });
}

function aplicarStatus(linhas) {
  if (!estado.status) return linhas;
  return linhas.filter((linha) => linha.faixa === estado.status);
}

function corFaixa(nome) {
  const faixa = painel.faixas.find((item) => item.nome === nome);
  return faixa ? faixa.cor : "#9aa3b2";
}

function contar(linhas, faixa) {
  return linhas.filter((linha) => linha.faixa === faixa).length;
}

function graficoRosca(linhas) {
  const labels = [];
  const values = [];
  const colors = [];
  painel.faixas.forEach((faixa) => {
    const quantidade = contar(linhas, faixa.nome);
    if (!quantidade) return;
    labels.push(faixa.nome);
    values.push(quantidade);
    colors.push(faixa.cor);
  });
  if (!values.length) return figuraVazia("Sem metas neste recorte");
  const layout = layoutBase();
  layout.title = { text: "Posição no quadrimestre", font: { size: 14 } };
  layout.showlegend = true;
  return {
    data: [{ type: "pie", labels, values, hole: 0.62, marker: { colors }, sort: false }],
    layout,
  };
}

function graficoPosicoes(linhasAno) {
  if (!linhasAno.length) return figuraVazia("Sem metas neste recorte");
  const eixo = painel.quadrimestres.map((quadrimestre) => `${quadrimestre}º`);
  const data = [];
  painel.faixas.forEach((faixa) => {
    const alturas = painel.quadrimestres.map((quadrimestre) => contar(
      linhasAno.filter((linha) => linha.quadrimestre === quadrimestre),
      faixa.nome,
    ));
    if (!alturas.some((altura) => altura)) return;
    data.push({ type: "bar", name: faixa.nome, x: eixo, y: alturas, marker: { color: faixa.cor } });
  });
  if (!data.length) return figuraVazia("Sem metas neste recorte");
  const layout = layoutBase();
  layout.barmode = "stack";
  layout.title = { text: "Metas por posição no ano", font: { size: 14 } };
  return { data, layout };
}

function graficoSecretarias(linhas) {
  if (!linhas.length) return figuraVazia("Sem metas neste recorte");
  const nomes = linhas.map((linha) => {
    const meta = painel.metas.find((item) => item.id === linha.id);
    return meta && meta.secretaria ? meta.secretaria : "Sem secretaria";
  });
  const secretarias = [...new Set(nomes)].sort();
  const data = [];
  painel.faixas.forEach((faixa) => {
    const alturas = secretarias.map((secretaria) => linhas.filter((linha, indice) => nomes[indice] === secretaria && linha.faixa === faixa.nome).length);
    if (!alturas.some((altura) => altura)) return;
    data.push({
      type: "bar",
      name: faixa.nome,
      x: secretarias,
      y: alturas,
      marker: { color: faixa.cor },
      customdata: alturas,
      hovertemplate: "%{x}<br>%{fullData.name}: %{customdata} metas (%{y:.1f}%)<extra></extra>",
    });
  });
  if (!data.length) return figuraVazia("Sem metas neste recorte");
  const layout = layoutBase();
  layout.barmode = "stack";
  layout.barnorm = "percent";
  layout.xaxis.tickangle = -20;
  layout.yaxis.ticksuffix = "%";
  layout.yaxis.range = [0, 100];
  layout.margin = { l: 48, r: 16, t: 36, b: 72 };
  layout.title = { text: "Distribuição por secretaria no quadrimestre", font: { size: 14 } };
  return { data, layout };
}

function classeSuperacao(observado, metaAnual, tipo) {
  if (observado == null || metaAnual == null) return "Sem informação";
  if (tipo === "ENTREGA_DECRESCENTE" || tipo === "NIVEL_DECRESCENTE") {
    return observado <= metaAnual ? "Já superada" : "Ainda não";
  }
  if (tipo === "ENTREGA_CRESCENTE" || tipo === "NIVEL_CRESCENTE") {
    return observado >= metaAnual ? "Já superada" : "Ainda não";
  }
  return "Sem informação";
}

const SITUACOES_ANO = [
  { nome: "Já superada", cor: "#38bdf8" },
  { nome: "Ainda não", cor: "#475569" },
  { nome: "Sem informação", cor: "#9aa3b2" },
];

function resumoSuperadas(ids) {
  const ano = painel.ano_vigente;
  const porMeta = new Map(painel.metas.map((meta) => [meta.id, meta]));
  const contagem = new Map();
  ids.forEach((id) => {
    const meta = porMeta.get(id);
    if (!meta) return;
    const leituras = painel.resultados
      .filter((linha) => linha.id === id && linha.ano === ano && linha.observado != null)
      .sort((a, b) => b.quadrimestre - a.quadrimestre);
    const secretaria = meta.secretaria || "Sem secretaria";
    if (!contagem.has(secretaria)) {
      contagem.set(secretaria, { "Já superada": 0, "Ainda não": 0, "Sem informação": 0 });
    }
    const situacao = classeSuperacao(
      leituras.length ? leituras[0].observado : null,
      meta.metas_anuais[String(ano)],
      meta.tipo,
    );
    contagem.get(secretaria)[situacao] += 1;
  });
  return { ano, contagem };
}

function totaisSuperadas(contagem) {
  const totais = { "Já superada": 0, "Ainda não": 0, "Sem informação": 0 };
  contagem.forEach((item) => {
    SITUACOES_ANO.forEach((situacao) => {
      totais[situacao.nome] += item[situacao.nome];
    });
  });
  return totais;
}

function desenharKpisSuperadas(resumo) {
  const totais = totaisSuperadas(resumo.contagem);
  const total = SITUACOES_ANO.reduce((soma, situacao) => soma + totais[situacao.nome], 0);
  document.getElementById("titulo-superadas").textContent = `Metas já superadas em ${resumo.ano}`;
  document.getElementById("kpis-superadas").innerHTML = SITUACOES_ANO.map((situacao) => `
    <div class="kpi-card">
      <div class="kpi-label">${situacao.nome}</div>
      <div class="kpi-valor-linha">
        <span class="kpi-value" style="color:${situacao.cor}">${totais[situacao.nome]}</span>
        <span class="kpi-pct">${fmtPct(totais[situacao.nome], total)}</span>
      </div>
    </div>`).join("");
}

function graficoRoscaSuperadas(resumo) {
  const totais = totaisSuperadas(resumo.contagem);
  const labels = [];
  const values = [];
  const colors = [];
  SITUACOES_ANO.forEach((situacao) => {
    if (!totais[situacao.nome]) return;
    labels.push(situacao.nome);
    values.push(totais[situacao.nome]);
    colors.push(situacao.cor);
  });
  if (!values.length) return figuraVazia("Sem metas neste recorte");
  const layout = layoutBase();
  layout.title = { text: `Metas já superadas em ${resumo.ano}`, font: { size: 14 } };
  layout.showlegend = true;
  return {
    data: [{ type: "pie", labels, values, hole: 0.62, marker: { colors }, sort: false }],
    layout,
  };
}

function graficoSuperadas(resumo) {
  const secretarias = [...resumo.contagem.keys()].sort();
  if (!secretarias.length) return figuraVazia("Sem metas neste recorte");
  const data = SITUACOES_ANO.flatMap((situacao) => {
    const alturas = secretarias.map((secretaria) => resumo.contagem.get(secretaria)[situacao.nome]);
    if (!alturas.some((altura) => altura)) return [];
    return [{
      type: "bar",
      name: situacao.nome,
      x: secretarias,
      y: alturas,
      marker: { color: situacao.cor },
      hovertemplate: "%{x}<br>%{fullData.name}: %{y} metas<extra></extra>",
    }];
  });
  if (!data.length) return figuraVazia("Sem metas neste recorte");
  const layout = layoutBase();
  layout.barmode = "stack";
  layout.xaxis.tickangle = -20;
  layout.margin = { l: 48, r: 16, t: 36, b: 72 };
  layout.title = { text: "Por secretaria executiva", font: { size: 14 } };
  return { data, layout };
}

function graficoAno(meta, linhas) {
  if (!meta || !linhas.length) return figuraVazia("Escolha uma meta");
  const ordenadas = [...linhas].sort((a, b) => a.quadrimestre - b.quadrimestre);
  const eixo = ordenadas.map((linha) => `${linha.quadrimestre}º`);
  const layout = layoutBase();
  layout.title = { text: `Evolução no ano ${estado.ano} · ${meta.unidade || ""}`, font: { size: 14 } };
  return {
    data: [
      {
        type: "scatter",
        name: "Projetado",
        x: eixo,
        y: ordenadas.map((linha) => linha.projetado),
        mode: "lines+markers",
        line: { color: "#9aa3b2", width: 2, dash: "dash" },
        marker: { color: "#9aa3b2", size: 7 },
        connectgaps: false,
      },
      {
        type: "scatter",
        name: "Observado",
        x: eixo,
        y: ordenadas.map((linha) => linha.observado),
        mode: "lines+markers",
        line: { color: "#e8eaed", width: 2.5 },
        marker: {
          color: ordenadas.map((linha) => corFaixa(linha.faixa)),
          size: 10,
          line: { color: "#1a2230", width: 1 },
        },
        connectgaps: false,
      },
    ],
    layout,
  };
}

function linhasTabela(recorte) {
  const porId = new Map(painel.metas.map((meta) => [meta.id, meta]));
  return recorte
    .map((linha) => ({ linha, meta: porId.get(linha.id) }))
    .filter((item) => item.meta)
    .sort((a, b) => naturalCompare(a.meta.id, b.meta.id))
    .map(({ linha, meta }) => {
      const registro = {
        Código: meta.id,
        Meta: meta.descricao,
        Quadriênio: fmtNumero(meta.quadrienio),
        Posição: linha.faixa,
        Projetado: fmtNumero(linha.projetado),
        Observado: fmtNumero(linha.observado),
        id: meta.id,
      };
      painel.anos.forEach((ano) => {
        registro[String(ano)] = fmtNumero(meta.metas_anuais[String(ano)]);
      });
      return registro;
    });
}

function desenharTabela(registros) {
  const colunas = ["Código", "Meta", "Quadriênio", ...painel.anos.map(String), "Posição", "Projetado", "Observado"];
  const cabeca = document.getElementById("tabela-cabeca");
  cabeca.innerHTML = `<tr>${colunas.map((coluna) => `<th>${coluna}</th>`).join("")}</tr>`;
  const corpo = document.getElementById("tabela-corpo");
  corpo.innerHTML = registros.map((registro) => {
    const classe = registro.id === estado.metaId ? "selecionada" : "";
    const celulas = colunas.map((coluna) => {
      const texto = textoHtml(registro[coluna] || "");
      const classeCelula = coluna === "Meta" ? "meta-texto" : "";
      return `<td class="${classeCelula}">${texto}</td>`;
    }).join("");
    return `<tr class="${classe}" data-id="${textoHtml(registro.id)}">${celulas}</tr>`;
  }).join("");
}

function itemResumo(rotulo, valor) {
  const texto = valor === null || valor === undefined || String(valor).trim() === "" ? "—" : textoHtml(valor);
  return `<div><div class="resumo-rotulo">${rotulo}</div><div class="resumo-valor">${texto}</div></div>`;
}

function desenharResumo(meta, linha) {
  const destino = document.getElementById("resumo-meta");
  if (!meta) {
    destino.innerHTML = `<p class="secao-lead">Escolha uma meta na tabela ou no seletor.</p>`;
    return;
  }
  const metaAno = fmtNumero(meta.metas_anuais[String(estado.ano)]);
  destino.innerHTML = `
    <div class="resumo-meta">
      <p class="resumo-descricao">${textoHtml(meta.descricao || "—")}</p>
      <div class="resumo-indicador">
        <div class="resumo-rotulo">Indicador de aferição</div>
        <div class="resumo-valor">${textoHtml(meta.indicador || "—")}</div>
      </div>
      <div class="resumo-destaque">
        <div class="resumo-rotulo">Meta projetada de ${estado.ano}</div>
        <div class="resumo-meta-ano">${metaAno || "—"}</div>
        <div class="resumo-unidade">${textoHtml(meta.unidade || "—")}</div>
      </div>
      <div class="resumo-grade">
        ${itemResumo("Secretaria", meta.secretaria)}
        ${itemResumo("Área", meta.area)}
        ${itemResumo("Tipo", meta.tipo)}
        ${itemResumo("Meta do quadriênio", fmtNumero(meta.quadrienio))}
        ${itemResumo(`Projetado no ${estado.quadrimestre}º`, fmtNumero(linha && linha.projetado))}
        ${itemResumo(`Observado no ${estado.quadrimestre}º`, fmtNumero(linha && linha.observado))}
        ${itemResumo(`Posição no ${estado.quadrimestre}º`, linha && linha.faixa)}
      </div>
    </div>`;
}

function desenharKpis(linhas) {
  const total = linhas.length;
  const cartoes = painel.faixas.filter((faixa) => faixa.nome !== "aguardando");
  const destino = document.getElementById("kpis");
  destino.innerHTML = cartoes.map((faixa) => {
    const quantidade = contar(linhas, faixa.nome);
    return `
      <div class="kpi-card">
        <div class="kpi-label">${faixa.nome}</div>
        <div class="kpi-valor-linha">
          <span class="kpi-value" style="color:${faixa.cor}">${quantidade}</span>
          <span class="kpi-pct">${fmtPct(quantidade, total)}</span>
        </div>
      </div>`;
  }).join("");
}

function areasDaSecretaria() {
  const areas = new Set();
  painel.metas.forEach((meta) => {
    if (estado.secretaria && meta.secretaria !== estado.secretaria) return;
    if (meta.area) areas.add(meta.area);
  });
  return [...areas].sort();
}

function atualizarFiltros() {
  const secretarias = [...new Set(painel.metas.map((meta) => meta.secretaria).filter(Boolean))].sort();
  preencherSelect("se", [{ value: "", label: "Todas" }, ...secretarias.map((valor) => ({ value: valor, label: valor }))], estado.secretaria);
  const areas = areasDaSecretaria();
  if (estado.area && !areas.includes(estado.area)) estado.area = "";
  preencherSelect("area", [{ value: "", label: "Todas" }, ...areas.map((valor) => ({ value: valor, label: valor }))], estado.area);
  preencherSelect("ano", painel.anos.map((ano) => ({ value: String(ano), label: String(ano) })), String(estado.ano));
  preencherSelect(
    "quadrimestre",
    painel.quadrimestres.map((quadrimestre) => ({ value: String(quadrimestre), label: `${quadrimestre}º` })),
    String(estado.quadrimestre),
  );
  preencherSelect(
    "status",
    [{ value: "", label: "Todos" }, ...painel.faixas.map((faixa) => ({
      value: faixa.nome,
      label: faixa.nome.charAt(0).toUpperCase() + faixa.nome.slice(1),
    }))],
    estado.status,
  );
  const recorteQuadrimestre = aplicarStatus(resultadosDoOrgao(estado.ano, estado.quadrimestre));
  const idsRecorte = new Set(recorteQuadrimestre.map((linha) => linha.id));
  const visiveis = metasPorOrgao().filter((meta) => idsRecorte.has(meta.id));
  if (!visiveis.some((meta) => meta.id === estado.metaId)) estado.metaId = visiveis.length ? visiveis[0].id : "";
  preencherSelect(
    "meta-sel",
    visiveis.map((meta) => ({ value: meta.id, label: `${meta.id} — ${meta.descricao.slice(0, 80)}` })),
    estado.metaId,
  );
}

function render() {
  atualizarFiltros();
  const recorte = aplicarStatus(resultadosDoOrgao(estado.ano, estado.quadrimestre));
  const ids = new Set(recorte.map((linha) => linha.id));
  const anoTodo = resultadosDoOrgao(estado.ano, null).filter((linha) => ids.has(linha.id));
  const resumoAno = resumoSuperadas(ids);
  desenharKpisSuperadas(resumoAno);
  desenhar("grafico-rosca-superadas", graficoRoscaSuperadas(resumoAno));
  desenhar("grafico-superadas", graficoSuperadas(resumoAno));
  desenharKpis(recorte);
  desenhar("grafico-rosca", graficoRosca(recorte));
  desenhar("grafico-posicoes", graficoPosicoes(anoTodo));
  desenhar("grafico-secretarias", graficoSecretarias(recorte));
  desenharTabela(linhasTabela(recorte));
  document.getElementById("contagem-lista").textContent = `${recorte.length} metas neste recorte`;
  const meta = ids.has(estado.metaId) ? painel.metas.find((item) => item.id === estado.metaId) || null : null;
  const doAno = painel.resultados.filter((linha) => linha.id === estado.metaId && linha.ano === Number(estado.ano));
  const doQuadrimestre = doAno.find((linha) => linha.quadrimestre === Number(estado.quadrimestre)) || null;
  desenharResumo(meta, doQuadrimestre);
  desenhar("grafico-ano", graficoAno(meta, doAno));
}

function exportar() {
  const registros = linhasTabela(aplicarStatus(resultadosDoOrgao(estado.ano, estado.quadrimestre))).map((registro) => {
    const linha = { ...registro };
    delete linha.id;
    return linha;
  });
  const planilha = XLSX.utils.json_to_sheet(registros);
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, "Metas");
  XLSX.writeFile(livro, "metas-parciais.xlsx");
}

function aoMudar(id, acao) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.addEventListener("change", acao);
}

function ligarEventos() {
  aoMudar("se", (evento) => {
    estado.secretaria = evento.target.value;
    render();
  });
  aoMudar("area", (evento) => {
    estado.area = evento.target.value;
    render();
  });
  aoMudar("ano", (evento) => {
    estado.ano = Number(evento.target.value);
    render();
  });
  aoMudar("quadrimestre", (evento) => {
    estado.quadrimestre = Number(evento.target.value);
    render();
  });
  aoMudar("status", (evento) => {
    estado.status = evento.target.value;
    render();
  });
  aoMudar("meta-sel", (evento) => {
    estado.metaId = evento.target.value;
    render();
  });
  const corpo = document.getElementById("tabela-corpo");
  if (corpo) {
    corpo.addEventListener("click", (evento) => {
      const linha = evento.target.closest("tr");
      if (!linha) return;
      estado.metaId = linha.dataset.id;
      render();
    });
  }
  const exportarBtn = document.getElementById("btn-exportar");
  if (exportarBtn) exportarBtn.addEventListener("click", exportar);
  const atualizar = document.getElementById("btn-refresh");
  if (atualizar) atualizar.addEventListener("click", () => carregar(true));
  const logo = document.getElementById("logo");
  if (logo) {
    logo.addEventListener("error", (evento) => {
      evento.target.hidden = true;
    });
  }
}

async function carregar(forcar) {
  const aviso = document.getElementById("aviso");
  try {
    const endereco = forcar ? `dados/painel.json?t=${Date.now()}` : "dados/painel.json";
    const resposta = await fetch(endereco);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    painel = await resposta.json();
    if (!iniciado) {
      estado.ano = painel.ano_vigente;
      estado.quadrimestre = painel.quadrimestre_vigente;
      iniciado = true;
    }
    document.getElementById("subtitulo").textContent = `${painel.fonte} · vigente ${painel.ano_vigente} / ${painel.quadrimestre_vigente}º quadrimestre`;
    aviso.hidden = true;
    try {
      render();
    } catch (erroDesenho) {
      aviso.hidden = false;
      aviso.textContent = "Os dados foram lidos, mas a página não conseguiu montar os gráficos. Atualize com Ctrl+F5.";
    }
    if (typeof Plotly === "undefined") {
      aviso.hidden = false;
      aviso.textContent = "Os dados foram lidos, mas a biblioteca dos gráficos não carregou. Atualize com Ctrl+F5.";
    }
  } catch (erro) {
    aviso.hidden = false;
    aviso.textContent = "Não foi possível ler dados/painel.json. Rode exportar-site.bat.";
    document.getElementById("subtitulo").textContent = "Aguardando a exportação";
  }
}

ligarEventos();
carregar(false);
