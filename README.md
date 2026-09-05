# Apex Strategy

Jogo offline de gerenciamento de corridas automobilísticas, construído com TypeScript, Vite e Canvas 2D. Os carros correm automaticamente; o jogador gerencia ritmo, pneus e pit stops de uma equipe com dois carros.

## Executar

```bash
npm install
npm run dev
```

Para gerar a versão offline de produção:

```bash
npm run build
npm run preview
```

## Recursos do MVP

- três circuitos fictícios com geometrias e características próprias;
- corridas de 1 a 100 voltas, com 2 a 20 competidores;
- dois carros configuráveis pelo jogador, sem números duplicados;
- motor independente da interface e baseado em `deltaTime`;
- pneus macio, médio e duro, modos de ritmo e pit stops;
- adversários com habilidade, consistência e estratégia de pneus;
- classificação ao vivo, velocidades 1×/2×/4×, pausa e resultado completo;
- câmera com zoom de 1× a 4×, movimentação por arraste e distância em metros entre os carros;
- preferências e última configuração persistidas no `localStorage`.
