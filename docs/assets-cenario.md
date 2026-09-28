# Assets de cenário

Registro dos tilesets e objetos de cenário (artista-cenario). Personagens e monstros estão em `docs/assets.md`.
Todos os assets são 32px/tile, visão "low top-down", gerados no PixelLab (MCP `pixellab`) salvo indicação.
Preview de integração (cena de teste 2x, montada com estes arquivos): `docs/assets-cenario-preview.png`.

## Tilesets Wang (`public/assets/tiles/<nome>/`)

Cada pasta tem:
- `tileset.png` — 128x128, grade 4x4 de tiles 32x32. `frame = row*4 + col`.
- `wang.json` — mapeamento simplificado (gerado por nós): `{ tileSize, columns, rows, lower, upper, tiles: [{ col, row, x, y, NW, NE, SW, SE }] }`, cantos com o nome do terreno.
- `metadata.json` — metadados originais do PixelLab (use `bounding_box`, nunca `wang_N`/`original_position` para posição).

| Nome | lower (terreno "baixo") | upper | ID PixelLab | Obs. |
|---|---|---|---|---|
| `cloud-grass` | `cloud` | `grass` | `7e609600-1f84-4d48-a885-581acfacb8af` | Borda da ilha: penhasco de terra/rocha nas bordas sul, tufos de grama nas demais. transition 0.5. |
| `grass-path` | `path` | `grass` | `f73fc187-f943-4e40-8261-135b27bec4a5` | Terra batida. **Cores da grama remapeadas** para a paleta da base (o gerador saiu com verde-limão). |
| `grass-plaza` | `plaza` | `grass` | `5aa46cf8-d954-4483-9384-52c0a75c814d` | Pedra cinza-azulada com meio-fio escuro. |
| `grass-water` | `water` | `grass` | `eb25d2e5-9a25-43cf-a003-1cedf9d5b9df` | Lago com margem de areia e espuma. |

Todos encadeados pelo tile base de grama `7b4e8624-2401-41f3-9fe3-40037768c5a7` (mesma grama nos 4).
Tile base de cada terreno (para futuros encadeamentos): cloud `ae337aa3-4d92-4c1d-91f1-ffa4f90797c3`,
path `066d637c-6f59-4a9a-b84d-84f8593d3d8b`, plaza `f8f048ae-c2f9-4ff1-85d7-968bddc87166`, water `ffc7b18d-e594-42c7-9ab9-c0dcd3295279`.

### Layout (idêntico nos 4 tilesets)
Código = cantos `NW NE SW SE`, `U` = upper (grama), `L` = lower (nuvem/caminho/praça/água).

| row\col | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| 0 | UULU | ULUL | LULL | UULL |
| 1 | LUUL | ULLL | **LLLL** (lower puro) | LLLU |
| 2 | ULUU | LLUU | LLUL | LULU |
| 3 | **UUUU** (grama pura) | UUUL | ULLU | LUUU |

Tabela de lookup pronta (índice = `NW*8 + NE*4 + SW*2 + SE`, com U=1, L=0 → frame):
```ts
// frame = row*4 + col
const WANG_FRAME = [6, 7, 10, 9, 2, 11, 4, 15, 5, 14, 1, 8, 3, 0, 13, 12];
```

### Como a engine deve usar (recomendação)
1. **Dual grid**: o terreno dos mapas (`tiles[y][x]`) vira a grade de *vértices*; cada tile desenhado fica entre 4 vértices,
   deslocado meio tile (−16px, −16px) — ou, equivalente, desenhar `(W+1)x(H+1)` células onde a célula `(x,y)` usa os vértices
   `(x-1,y-1) (x,y-1) (x-1,y) (x,y)`. A colisão continua na grade lógica de sempre.
2. **Camadas**: (a) base `cloud-grass` em todo o mapa, com "upper" = qualquer terreno que não seja `Cloud`;
   (b) por cima, uma camada por overlay (`grass-path`, `grass-plaza`, `grass-water`), desenhando só as células em que
   pelo menos um canto é daquele terreno.
3. **Atenção — overlays são opacos**: a parte de grama dos tiles de overlay cobre tudo embaixo. Numa célula com canto de
   nuvem, desenhar overlay apaga a borda da ilha (bug visível no preview à esquerda do caminho e à direita do lago).
   Regra: **não desenhar overlay em células com algum canto `Cloud`** (ou manter 1 vértice de grama entre
   caminho/água/praça e a borda). Onde a estrada chega à borda, a ponte cobre a emenda.
4. Dois overlays diferentes na mesma célula (ex.: caminho encostando na praça) não têm transição direta; na prática
   desenhar o overlay de maior prioridade por último (plaza > path) funciona bem porque ambos têm borda.
5. Mapeamento dos `Tile` atuais: `Cloud`→cloud; `Grass`/`Tree`/`Rock`/`Flowers`→grass (+ objeto); `Path`→path;
   `Plaza`→plaza; `Water`→water (a fonte da praça vira objeto `fountain` sobre plaza); `Bridge`→ `bridge-h` sobre nuvem;
   `Roof`/`Wall`→grass + objeto de casa.

## Objetos (`public/assets/objects/<nome>/`)

Cada pasta tem a imagem (fundo transparente) + `meta.json`:
`{ image, pixellabId, width, height, opaqueBounds{x0,y0,x1,y1}, pivot{x,y}, origin{x,y}, footprintTiles{w,h}, blocking, occludes, note }`.
- `pivot` = ponto de apoio no chão, em px da imagem; `origin` = mesmo ponto normalizado (usar em `setOrigin`).
- Profundidade: `depth = y do pivô no mundo` (mesma regra dos personagens) → o jogador passa atrás de copas/telhados.
- `footprintTiles` = área de colisão sugerida, alinhada pela base e centrada no pivô.

| Nome | Arquivo | Tamanho | Pivô (px) | Colisão (tiles) | ID PixelLab | Obs. |
|---|---|---|---|---|---|---|
| `tree-oak` | `object.png` | 64x80 | (32,72) | 1x1, bloqueia | `dcd753bd-2db1-4d1b-ab45-6789c5911f35` | Carvalho verde; copa ocupa ~2x2 tiles acima do tronco. |
| `tree-blossom` | `object.png` | 64x80 | (32,73) | 1x1, bloqueia | `cce66a39-9b79-48eb-b2af-9e46700d051f` | Cerejeira rosa. |
| `rock` | `object.png` | 32x32 | (16,28) | 1x1, bloqueia | `cc87942f-afc4-4887-a447-0003548848e6` | Pedra alta com musgo (var. A). |
| `rock-b` | `object.png` | 32x32 | (16,26) | 1x1, bloqueia | `904a3539-ef36-4e16-a54f-9fbd0c913942` | Pedregulho baixo (var. B). |
| `bush-flowers` | `object.png` | 32x32 | (16,26) | 1x1, não bloqueia | `7749a24a-f6d3-4111-a030-2fbb989f4414` | Substitui `Tile.Flowers`. |
| `fountain` | `object.png` | 64x64 | (32,58) | 2x2, bloqueia | `905d8ed5-2949-4bdc-b7aa-2f4a578f8072` | Fonte da praça (área 2x2 do town.ts). |
| `house-red` | `object.png` | 192x160 | (96,147) | 5x3, bloqueia | `d3a52112-3259-429f-b2df-69107137850b` | Porta no centro da base (x=96). |
| `house-orange` | `object.png` | 192x160 | (96,149) | 5x3, bloqueia | `c43da673-406c-473b-a15d-aef31f61f8b4` | Porta no centro da base. |
| `house-blue` | `object.png` | 160x160 | (80,123) | 4x2, bloqueia | `1fa0db75-ee30-434e-a196-169e2d869b67` | Chão embutido removido à mão; transparente abaixo de y=123. |
| `bridge-h` | `bridge-h.png` | 32x96 | — | não bloqueia | — (script, paleta de `55b7e330…`) | Ponte horizontal **tileável**: 3 frames 32x32 empilhados (0 = borda norte, 1 = deck, 2 = borda sul). Repetir na horizontal. |
| `bridge-v` | `object.png` | 96x96 | — | 3x3, não bloqueia (deck) | `55b7e330-d810-47dc-974e-dfeae668abf4` | Ponte **vertical** (N-S) com postes; não tileável. |

Casas: parede frontal ≈ 2 tiles, telhado ≈ 2,3 tiles. Com colisão de 3 linhas pela base, o topo do telhado (~1,4 tile)
fica fora da colisão e cobre o jogador que anda atrás. As casas do `town.ts` têm 6 ou 5 tiles de largura: use
`house-red`/`house-orange` nas de 6 e `house-blue` nas de 5 (ela tem só ~3,6 tiles de largura visível).
Sem interiores por enquanto: a porta é só visual (o tile de caminho em frente continua).

## Gerações usadas (ciclo até 27/10/2026)
- Tilesets: 5 jobs (4 aceitos + 1 descartado: primeira versão de `grass-path` saiu como tijolos em grade).
- Map objects: 11 jobs (9 aceitos; ponte lateral `729af7ea-5318-43da-a609-275e0dcfd939` descartada; `55b7e330…` virou `bridge-v`).
- Saldo antes/depois: 1949 → 1915 (34, mas o artista-pixel gerou em paralelo na mesma conta; estimativa própria ≈ 25-30).
- Ajustes grátis feitos localmente: remapeamento de cor do `grass-path`, remoção do chão da `house-blue`, `bridge-h` desenhada por script.

---

# Marco 2 — Bosque Sussurrante e Vila Brisa viva (28/09/2026)

Previews (1x, montados com os arquivos finais): `docs/assets-cenario-bosque-preview.png` (dual grid real + objetos)
e `docs/assets-cenario-vila-preview.png` (objetos da Vila sobre a praça).

## Tilesets do Bosque (`public/assets/tiles/<nome>/`)

Mesmo formato dos da Vila: `tileset.png` 128x128 (4x4 de 32px), `wang.json`, `metadata.json`.
**Layout idêntico** — a mesma tabela `WANG_FRAME = [6, 7, 10, 9, 2, 11, 4, 15, 5, 14, 1, 8, 3, 0, 13, 12]` vale
(conferido pelos cantos do metadata). O terreno "alto" dos 3 é `moss` (musgo), que faz o papel da `grass` da Vila.

| Nome | lower | upper | ID PixelLab | Obs. |
|---|---|---|---|---|
| `cloud-moss` | `cloud` | `moss` | `9212aa0e-6d51-4e79-8a44-79d99b4e999e` | Borda da ilha com penhasco de terra escura. Tem `tileset-cutout.png` (nuvem removida por distância de cor, como a `cloud-grass`). Nuvem = mesmo tile base da Vila. |
| `moss-dirt` | `dirt` | `moss` | `54c8555a-d54d-4c7b-bd26-5c36d978a83f` | Trilha de terra com folhas, transição 0 (plana, igual à `grass-path`). |
| `moss-stream` | `stream` | `moss` | `317606dd-7c78-410f-843c-75fa3544562f` | Riacho turquesa raso com seixos; margem baixa com degrau escuro (transição 0.25). Bloqueia como `Water`. |

- Encadeados pelo tile base de musgo `0192cc8d-d4b5-410e-b3a2-dd932e52dfda`; terra `628aaf4e-85b7-4661-81ae-dd8e353c5e9c`,
  riacho `5f577444-80f8-4ead-a6b2-71adbbd9b808`.
- **Cores do musgo remapeadas** (grátis, script): o gerador saiu com verde puro saturado `(10,134,38)`; hue −0.03
  (para o amarelo) e saturação ×0.8 nos pixels verdes dos 3 sheets (e no cutout) → principal `(35,137,40)`, realces
  `(107,198,46)`. Fica mais escuro que a grama da Vila, mas quente (verde-dourado). Água intocada.
- Uso na engine: igual à Vila, trocando `cloud-grass`→`cloud-moss`, `grass-path`→`moss-dirt`, `grass-water`→`moss-stream`
  (a regra "não desenhar overlay em célula com canto de nuvem" continua valendo). Sugestão: um campo `theme`/`tileset`
  no `MapDef` escolhendo o conjunto (`meadow` = Vila/Campos, `forest` = Bosque).
- Descartado: 1ª versão da `moss-dirt` (`bfd77e02-4b6b-41e6-ad4e-1689186c3121`, transição 0.25) — a trilha parecia uma vala funda.

## Objetos do Bosque (`public/assets/objects/<nome>/`)

Mesmo `meta.json` dos anteriores (`pivot` = base no chão; `occludes` = cobre o jogador que passa atrás).

| Nome | Tamanho | Pivô (px) | Colisão | ID PixelLab | Obs. |
|---|---|---|---|---|---|
| `bamboo` | 64x96 | (31,89) | 1x1, bloqueia | `43a3eeea-c216-4753-9870-41e91df41bff` | Moita de bambu fina e alta (verde-limão). |
| `bamboo-b` | 64x96 | (32,88) | 1x1, bloqueia | `71e9ff41-6f65-40be-a51a-ae4b5499f5e0` | Moita densa verde-jade, copa larga. Alternar com `bamboo` por hash. |
| `mushroom-red` | 64x80 | (32,73) | 1x1, bloqueia | `bb5ffec4-99ca-44e3-a5c6-18ef80321e4c` | Cogumelo gigante vermelho de bolinhas. |
| `mushroom-teal` | 64x80 | (32,70) | 1x1, bloqueia | `3b603e96-0d50-4e48-8f00-25126c65d8bd` | Cogumelo gigante turquesa "luminoso". |
| `mushroom-gold` | 48x48 | (24,42) | não bloqueia | `ade5cbc2-de72-40e2-826f-fdc67044c224` | Trio de cogumelos dourados baixos (decoração pisável). |
| `log-moss` | 96x48 | (48,35) | 3x1, bloqueia | `99dc4c13-c70a-45d7-a630-a32489280ac2` | Tronco caído horizontal com musgo e cogumelinhos. |
| `rock-moss` | 48x48 | (24,40) | 1x1, bloqueia | `8718d181-1784-4551-980f-4d3b163fb5ba` | Pedregulho com musgo e florzinhas. |
| `rock-moss-b` | 32x32 | (16,24) | 1x1, bloqueia | `19b7ff2b-0ea4-4d44-944c-95433eee72ef` | Pedrinha com samambaias (pequena, pouco visível; bom para bordas). |
| `flowers-glow` | 32x32 | (16,24) | não bloqueia | `67906365-a601-43a2-ba86-c2d19898760f` | Flores luminosas ciano/douradas. Candidata a brilho aditivo pulsando. |
| `lantern-firefly` | 32x64 | (16,55) | 1x1, bloqueia | `661f26d2-aabc-42cf-b311-8d1a26b56fcb` | Poste com pote de vagalumes (luz dourada). Candidata a luz/partículas. |
| `tree-forest` | 80x96 | (40,87) | 1x1, bloqueia | `650a6894-39f4-491d-a478-ce61d6af51e4` | Árvore de copa verde-dourada (extra — o bosque precisava de árvore própria). |
| `bridge-stream` | 96x104 | (48,87) | 2x2, **não** bloqueia | `893f69fe-74c8-4f55-b407-479c9da40ac0` | Ponte de tábuas para travessia **norte-sul** de riacho que corre **leste-oeste** (1 célula lógica de largura). Deck em `meta.deck` (x13-82, y24-82). 2 faixas de tábua duplicadas à mão para cobrir o riacho. Desenhar com depth de ponte (−5); água sob ela andável. Travessia leste-oeste: usar `bridge-h` da Vila. |

Descartados: tronco inclinado/fino `656d58be-8698-4af6-ac1f-147d7b314b40`; ponte em arco vista de lado
`7ee13c18-283d-442f-9024-26013aaf9ea0` (deck quase invisível no top-down).

## Objetos da Vila Brisa (item 5)

| Nome | Tamanho | Pivô (px) | Colisão | ID PixelLab | Obs. |
|---|---|---|---|---|---|
| `return-stone` | 64x96 | (32,90) | 2x1, bloqueia | `ac667799-7801-4243-8088-fe0f9d6866a4` | Pedra de Retorno: obelisco flutuando sobre base redonda. **2 estados**, mesmo tamanho/pivô: `object.png` = inativa (runa apagada, feita por script a partir do original), `object-active.png` = ativada (runa ciano + halo de 1px). `meta.states` lista os dois. |
| `merchant-stall` | 96x96 | (45,80) | 3x1, bloqueia | `28520663-516e-4a15-b74e-709469cd4ab1` | Barraca do Mercador: toldo listrado vermelho/amarelo, balcão com poções, barril. Grama da base removida à mão. NPC na frente do balcão (sul). |
| `seal-altar` | 80x64 | (40,59) | 2x1, bloqueia | `742d41be-c4bb-4a5c-8c6c-649b1238b6eb` | Mesa da Seladora: toalha roxa, selos, tinteiro, pergaminho, vela. |

## Gerações usadas (Marco 2, itens 5 e 6)
- Tilesets: 4 jobs (3 aceitos + 1 descartado), ~3-4 gerações cada → ~13.
- Map objects: 17 jobs (15 aceitos, 2 descartados) → ~17.
- Total estimado: **~30 gerações** (saldo 1839 → 1791 no período, mas o artista-pixel gerou em paralelo na mesma conta).
- Ajustes grátis (script local): remapeamento do musgo, cutout da `cloud-moss`, estados da Pedra de Retorno,
  alongamento da `bridge-stream`, limpeza da grama da barraca.
