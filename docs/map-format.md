# Formato de Mapa

## Visão Geral
Os mapas do jogo são definidos pela interface `MapDef` em `src/maps/types.ts`.
Atualmente usamos geração procedural em código, mas a estrutura está preparada para suportar Tiled JSON ou outros formatos.

## Estrutura MapDef

```typescript
interface MapDef {
  id: string;           // Chave da cena Phaser (ex: 'town', 'field')
  name: string;         // Nome exibido ao jogador
  width: number;        // Largura em tiles
  height: number;       // Altura em tiles
  tiles: Tile[][];      // Grid de tiles [y][x]
  spawns: Record<string, { x: number; y: number }>;  // Pontos de chegada
  exits: MapExit[];     // Áreas que levam a outros mapas
  monsterSpawns: MonsterSpawnRule[];  // Regras de spawn de monstros
  safe: boolean;        // Se true, vira "último ponto seguro"
  theme?: MapTheme;     // 'meadow' (padrão: Vila/Campos) | 'forest' (Bosque)
  props?: MapProp[];    // Objetos colocados à mão: { kind, rect } (rect = footprint já marcado na grade)
  npcs?: NpcPlacement[];            // { npcId, x, y, facing? } — npcId de src/data/npcs.json
  returnStones?: ReturnStonePlacement[]; // { id, name, rect (2x1), spawnId, startsActive? }
}
```

Mapas atuais: `town` (Vila Brisa, 44x32), `field` (Campos de Pêssego, 64x48), `forest` (Bosque Sussurrante, 90x64).
Ligações: town ⇄ field (ponte leste da Vila / oeste do campo), field ⇄ forest (ponte leste do campo / oeste do
Bosque). Spawns nomeados: `fromField`, `fromTown`, `fromForest` e `returnStone` (chegada do teleporte, colada na pedra).

## Tiles

Enum em `src/maps/types.ts`:
- `Cloud` (0) — bloqueante, fora da ilha
- `Grass` (1) — chão básico
- `Path` (2) — caminho
- `Water` (3) — bloqueante
- `Tree` (4) — bloqueante
- `Wall` (5) — bloqueante
- `Rock` (6) — bloqueante
- `Flowers` (7) — decoração
- `Bridge` (8) — caminho sobre nuvens
- `Roof` (9) — bloqueante, telhado
- `Plaza` (10) — chão de praça
- `Prop` (11) — bloqueante, ocupado por objeto colocado à mão (`props`, Pedra de Retorno); o chão desenhado
  embaixo é o terreno mais comum entre os vizinhos (a barraca na praça fica sobre praça)
- `Deck` (12) — ponte sobre água (`bridge-stream`): andável; o chão desenhado continua sendo água

**Tiles bloqueantes**: definidos em `BLOCKING_TILES`.

## Layers Esperados (futuro com tilesets reais)

Quando os tilesets do PixelLab chegarem, o formato deverá suportar:

### 1. Layer de Chão (ground)
- Tiles de terreno base (grama, terra, pedra)
- Sempre passável, exceto água

### 2. Layer de Colisão (collision)
- Tiles ou shapes que bloqueiam movimento
- Phaser arcade physics ou grid-based pathfinding

### 3. Layer de Objetos (objects)
- Árvores, pedras, decorações
- Alguns bloqueantes, outros não

### 4. Layer de Estruturas (buildings)
- Paredes, telhados, pontes
- Sempre bloqueantes

### 5. Spawn Points
- Posições nomeadas para jogador (`spawns`)
- Áreas para monstros (`monsterSpawns`)

### 6. Portais/Exits
- Áreas retangulares (`MapExit.area`)
- Destino: `toMap` + `toSpawn`

## Sistema de Transição Entre Mapas

### Como Funciona

1. **Detecção**: `WorldScene.checkExits()` verifica a cada frame se o jogador está em uma área de saída
2. **Ativação**: quando detectado, chama `WorldScene.travel(toMap, toSpawn)`
3. **Processo**:
   - Flag `traveling` vira `true`
   - Jogador para de se mover
   - Evento `mapExiting` é emitido (gameplay congela IA/dano)
   - Fade out da câmera (250ms)
   - Remove todas as entidades (monstros, NPCs)
   - `scene.start(toMap, { spawnId, facing })`
   - Nova cena faz fade in (250ms)

### Dados Carregados na Transição

```typescript
interface TravelData {
  spawnId?: string;     // Onde spawnar no novo mapa
  facing?: Direction8;  // Direção que o jogador estava olhando
}
```

### Exemplos nos Mapas Atuais

**Town → Field**:
```typescript
exits: [{ 
  area: { x: 42, y: 14, w: 2, h: 3 },  // Ponte leste
  toMap: 'field', 
  toSpawn: 'fromTown' 
}]
```

**Field → Town**:
```typescript
exits: [{ 
  area: { x: 0, y: 22, w: 2, h: 3 },   // Ponte oeste
  toMap: 'town', 
  toSpawn: 'fromField' 
}]
```

## Integração com Tilesets

Decisão: **geração procedural + arte real por cima** (Opção 2). A grade lógica `tiles[y][x]` continua sendo
a fonte de colisão e pathfinding (`BLOCKING_TILES`); o cenário do PixelLab é só visual e é derivado dela.

- Caminhos dos assets: `src/assets/scenery.ts` (tilesets, objetos, `WANG_FRAME`).
- Layout puro (testável, sem Phaser): `src/maps/scenery.ts` → `buildSceneryLayout(map)`.
  - Terreno por tile: `Cloud`/`Bridge`→cloud; `Path`→path; `Plaza`→plaza; `Water`→water; resto→grass.
  - Dual grid: (W+1)x(H+1) células, deslocadas (−16, −16). Base `cloud-grass` em todas; overlays
    `path` → `water` → `plaza` só onde há canto daquele terreno e nenhum canto de nuvem.
    A praça trata `path` como "lower" (sem faixa de grama entre praça e estrada).
  - Objetos: bloco Roof/Wall → 1 casa; o tamanho do bloco é o `footprintTiles` do sprite
    (`HOUSE_FOOTPRINTS`: 5x3 → `house-red`/`house-orange` alternadas, 4x2 → `house-blue`), pivô na base centrada; água cercada só por praça → `fountain` (terreno vira praça);
    `Tree` → `tree-oak`/`tree-blossom`, `Rock` → `rock`/`rock-b` (variação por hash da célula);
    `Flowers` → `bush-flowers`; bloco `Bridge` → retângulo de `bridge-h` (+1 coluna em cada ponta).
- Renderização: `src/systems/scenery.ts` (`preloadScenery` no BootScene, `renderScenery` no WorldScene).
  Depth: chão −10..−7, ponte −5, objetos = y do pivô (decoração pisável = y − 32).
- Fallback: faltou tileset → camada lógica provisória fica visível e nada da arte nova é desenhado;
  faltou objeto → os tiles provisórios da área dele são desenhados no lugar.
- `town.ts`: `house(tiles, kind, x, baseY)` gera Roof/Wall só no footprint do sprite (linha `baseY` = porta).
  O telhado acima da colisão fica andável e cobre o jogador (depth = y do pivô); essa faixa
  (`HOUSE_ROOF_OVERHANG`) fica livre de árvores/flores. Casas de largura par têm porta de 2 tiles.

## Temas, props, NPCs e Pedras de Retorno (Marco 2)

- **Tema** (`src/assets/scenery.ts` → `THEMES`): escolhe base/recorte/overlays e os objetos de `Tree`/`Rock`/`Flowers`.
  `forest`: `cloud-moss` + `moss-dirt` (Path) + `moss-stream` (Water); sem overlay de praça. Árvores `tree-forest`/
  `bamboo`/`bamboo-b`, pedras `rock-moss`/`rock-moss-b`, flores `flowers-glow`/`mushroom-gold` (pisáveis).
- **Props** (`placeProp(tiles, kind, x, y)` em `gen.ts`): footprint = `PROP_FOOTPRINTS` (igual ao `footprintTiles` do
  meta.json, testado). Marca `Tile.Prop` (ou `Tile.Deck` para `bridge-stream`) e devolve o `MapProp`.
  `bridge-stream` só para riacho que corre leste-oeste (travessia norte-sul, 2x2 sobre 2 linhas de água);
  para travessia leste-oeste use `bridge-h` (Tile.Bridge).
- **Ponte sobre nuvens**: `cloudBridgeRoad(tiles, rect, 'west' | 'east')` faz a estrada, a ponte e os degraus do penhasco.
- **NPCs** (`src/systems/npcs.ts`, entidade `src/entities/Npc.ts`): clique → o jogador anda até o alcance
  (`INTERACT_RANGE`) → caixa de diálogo com as falas de `src/data/npcs.json`; a última página oferece a ação (`shop`,
  `seals`, `pact`). O gameplay implementa a ação com `registerNpcAction(action, ({ npc, world }) => ...)`; sem handler,
  o NPC responde "volte mais tarde". Eventos: `npcInteracted`, `npcAction`. Visuais: `src/assets/npcs.ts` (placeholder).
- **Diálogo** (`src/systems/dialog.ts` + `src/ui/DialogScene.ts`): `openDialog({ speaker, lines, choices, onClose })`,
  `closeDialog()`. Espaço/Enter/clique avançam, Esc fecha, afastar-se do NPC fecha. Tecla E = interagir com o mais perto.
- **Pedra de Retorno** (`src/systems/returnStones.ts`, estado puro em `returnStoneState.ts`): usar ativa a pedra
  (troca para `object-active.png`), grava `session.lastSafePoint = { mapId, spawnId }` (destino ao cair; já vai para o
  save) e abre a lista das outras pedras ativadas para teletransporte (`world.travel`). Evento `returnStoneUsed`.
  A da Vila começa ativa (`startsActive`). **Pendente:** `session.activatedStones` ainda não é salvo.

## Mar de Nuvens (céu animado)

Só visual; mapa lógico, colisão e pathfinding não mudam. Manifesto: `src/assets/sky.ts`; engine: `src/systems/sky.ts`
(contas puras em `src/systems/skyMath.ts`).
- Camadas `sky-far` / `clouds-mid` / `clouds-near` (`public/assets/sky/`): TileSprites presas à tela, com parallax
  0.05 / 0.25 / 0.5, vento de 2 / 7 / 14 px/s e balanço de 0-3 px. Depth −100..−98.
- Nuvens avulsas `cloud-1..4.png`: 7 por baixo da ilha (depth −40) e 2 por cima (alfa 0.2, depth 30000 —
  acima dos personagens, abaixo das barras/textos do gameplay). Recicladas ao sair da tela.
- Ilha: `tileset-cutout.png` do tema (`cloud-grass` ou `cloud-moss`; nuvem transparente); células só de nuvem ficam vazias. Sem o arquivo,
  o recorte é gerado no boot removendo as cores do tile de nuvem pura.
- Sombra: silhueta da camada base + pontes, assada uma vez numa RenderTexture deslocada (6, 20) px, depth −20 (WebGL).
- Câmera: `CAMERA_SKY_MARGIN` (64 px) de céu além da borda; pontes na borda do mapa seguem 4 tiles para fora.
- Arquivo ausente → placeholder procedural gerado uma vez no boot (nada é recriado por frame).

## Checklist dos Tilesets

- [x] Decidir entre Tiled JSON vs procedural — procedural + dual grid
- [x] ~~Atualizar enum `Tile` com IDs reais~~ — desnecessário: `Tile` segue lógico, mapeado para terreno/objeto
- [x] Criar parser ou adaptar geração procedural — `buildSceneryLayout`
- [x] `generateTileset()` mantido só para colisão (camada invisível) e fallback
- [x] Colisão continua na grade lógica; ponte andável
- [x] Testar transições com visuais finais (cidade ↔ campo)
- [x] Objetos de cenário como sprites com origin do `meta.json` e depth por y do pivô
- [x] Colisão das casas por `footprintTiles` (jogador passa atrás do telhado; sem parede invisível larga)
- [ ] Lago com forma mais orgânica (a elipse em grade sai "em degraus")

## Notas Técnicas

- **Tile size**: 32px (definido em `src/config.ts`)
- **Coordenadas**: sempre em tiles, convertidas para px pela engine
- **Pathfinding**: A* sobre o grid, com suavização (smoothPath)
- **Câmera**: segue o jogador com lerp (0.15, 0.15)
- **Safe point**: ao entrar em mapa com `safe: true`, vira respawn na morte
