# Jogo Pixel — inspirado em Ragnarok Online e Trickster Online

## Visão
RPG de ação em pixel art, top-down baixo (~20°), personagens em 8 direções.
Mundo: ilhas-cidade flutuando sobre um mar de nuvens; classes vêm de Pactos com Espíritos Animais.
Detalhes em `docs/design.md`.
Clima e mecânicas inspirados em Ragnarok Online (classes, stats, monstros fofos como Poring, cartas)
e Trickster Online (escavação de tesouros, visual colorido). Não copiar assets, nomes registrados ou
textos dos jogos originais — só a inspiração.

## Stack
- Phaser 3 + TypeScript + Vite, roda no navegador.
- Assets gerados pelo PixelLab (MCP `pixellab`), exportados como PNG/sprite sheets em `public/assets/`.
- Projeto e deploy via PixelLab (git + `*.dev.pixellab.run`).

## Orçamento de assets
PixelLab Tier 1: 2000 gerações por ciclo (renova 27/10/2026).
Planejar a lista de assets antes de gerar; usar `pixelart_workbench` (grátis) para ajustes pequenos.
Registrar todo asset gerado em `docs/assets.md` (nome, ID PixelLab, tamanho, direções, animações).

## Marco 1 (primeira versão jogável)
- Aprendiz andando em 8 direções, câmera seguindo.
- 1 cidade + 1 campo, com transição entre mapas.
- 3 monstros (incluindo um Poring-like), IA simples.
- Combate por clique, HP/SP, EXP, level up, stats básicos, drops e inventário simples.

## Time de agentes (`.claude/agents/`)
- `artista-pixel` — personagens, monstros e animações no PixelLab (registro em `docs/assets.md`).
- `artista-cenario` — tilesets, objetos e prédios no PixelLab (registro em `docs/assets-cenario.md`).
- `programador-engine` — estrutura Phaser, mapas, movimento, câmera, colisão.
- `programador-gameplay` — combate, stats, EXP, drops, inventário, skills.
- `qa-revisor` — roda, testa e revisa cada entrega.
- `inovacao` — propõe melhorias, mecânicas novas e ideias que diferenciem o jogo.
O agente principal atua como diretor: define o design em `docs/design.md`, distribui tarefas e integra.

## Convenções
- Código em TypeScript estrito; nomes de código em inglês, textos do jogo em português.
- Dados de jogo (monstros, itens, classes) em JSON em `src/data/`, não hardcoded.
- `npm run build` deve passar antes de qualquer entrega.
