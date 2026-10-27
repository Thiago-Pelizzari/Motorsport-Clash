# Apex Strategy 2.0

Simulador tático offline de gerenciamento de corridas automobilísticas, construído com TypeScript, Vite e Canvas 2D. Os carros correm automaticamente; o jogador atua como estrategista-chefe gerenciando ritmo, compostos de pneus, temperatura, bateria ERS, combustível e pit stops de uma escuderia com dois carros.

## Executar

```bash
npm install
npm run dev
```

Para validar os testes automatizados e gerar a versão offline de produção:

```bash
npm test
npm run build
npm run preview
```

## Recursos (Edição 2.0)

- **Física de Pista Realista:** velocidade dinâmica baseada na curvatura local da spline Catmull-Rom (frenagens fortes em curvas, aceleração em retas, vácuo/slipstream, ar sujo e linha de corrida *out-in-out*);
- **5 Compostos de Pneus & Temperatura:** Macio (`S`), Médio (`M`), Duro (`H`), Intermediário (`I`) e Chuva (`W`), com janela térmica de operação e desgaste dinâmico;
- **Combustível Ativo & Bateria ERS:** consumo de combustível que deixa o carro mais leve volta a volta e sistema de recuperação/descarga de energia (`⚡ ERS`) para ataque e defesa;
- **Clima Dinâmico & Bandeiras:** transição entre pista seca, nublada, chuva leve e tempestade com acúmulo de água no asfalto, previsão meteorológica no HUD, Bandeira Amarela e Virtual Safety Car (`VSC`);
- **Pit Lane Físico & Reparos:** entrada e saída de box com limite de velocidade, via de pit lane desenhada na pista e opção de reparo de avarias (`🔧`);
- **IA Estratégica 2.0:** equipes rivais com dois carros, arquétipos de piloto, cálculo de janela de stint, *undercut* no tráfego, bandeira azul para retardatários e resposta imediata à chuva;
- **Modo Campeonato (Temporada):** calendário de 3, 6 ou 9 etapas com tabela oficial de pontos para o Mundial de Pilotos e Mundial de Construtores;
- **Definição de Grid & Customização de Equipe:** qualificação simulada, primeira fila, grid sorteado ou desafio de fundo de pelotão, além de nomes customizáveis para escuderia e pilotos;
- **Telemetria S1·S2·S3, Rádio e Pós-Corrida Analítico:** histórico de rádio da corrida, gráfico SVG de evolução de posições volta a volta, histórico de stints de pneus e prêmios de Volta Mais Rápida, Piloto do Dia e Melhor Pit Stop;
- **Oficina de Pistas 2.0:** 11 tipos de blocos (incluindo Grampos 180° e Esse Rápido), prévia em spline Catmull-Rom real, inserção de nós extras, detector de auto-interseção e cálculo automático de telemetria;
- **Áudio Procedural Web Audio API:** efeitos sintetizados em tempo real para rádio da equipe, pit stops, volta rápida e chegada, sem necessidade de arquivos de áudio externos.
