# Registro de assets

Estilo base: pixel art chibi/anime, visão "low top-down" (~20°), contorno preto de 1 cor,
paleta vibrante com sombreado suave. Gerado no PixelLab (modo v3).

Convenção dos sprite sheets (export PixelLab):
- Grid uniforme, 8 colunas, pivô no centro da célula (`pivot: cell-center`).
- Linha 0 = rotações estáticas nas 8 direções, na ordem:
  `south, south-east, east, north-east, north, north-west, west, south-west`.
- Linhas seguintes = uma animação por direção, na mesma ordem acima (ver o `.json` ao lado).
- Os frames avulsos em `animations/` podem ter tamanhos diferentes por direção (o v3 amplia o canvas);
  use o sprite sheet para ter células uniformes.

---

## Aprendiz (personagem jogável, classe inicial)

| Campo | Valor |
|---|---|
| ID PixelLab | `35c3f6d3-5227-4d3f-982f-c382bcc89ce6` |
| Tamanho base | 64x64 (personagem ocupa 44x62 px, vista sul) |
| Célula do sprite sheet | 88x88 (sheet 704x2200) |
| Direções | 8 |
| Pasta | `public/assets/characters/aprendiz/` |

Animações:

| Nome | Frames | Linhas no sheet | Observação |
|---|---|---|---|
| (rotações) | 8 (1 por direção) | 0 | pose parada |
| `idle` | 4 | 1-8 | respiração, tudo v3. SW usa os frames 0,1,0,1 da geração (2-3 saíram de olhos fechados); SE usa 0,0,2,2 da 2ª tentativa (1 e 3 tinham pálpebra caída / cabeça deslocada) |
| `walk` | 8 | 9-16 | tudo v3. S ainda é a versão antiga (já estava no tamanho certo) |
| `attack` | 7 | 17-24 | soco com passo à frente (sem arma), v3. Tocar uma vez: 20 fps = 0,35 s; impacto no frame 4 |

Alinhamento: em todas as células o pixel opaco mais baixo (o pé) fica em y=74, sem reescalar
(o `feetY: 73` em `src/assets/manifest.ts` continua valendo). Altura visível: rotações 61-62,
idle 58-63, walk 59-66.

Refeito em 2026-09-27 porque as direções geradas por template eram ~12% menores que as de v3:
- walk SE/E/W/SW refeito em v3 no grupo `672e7e1b-3e05-472b-99ab-21951ba2732a` (animações
  `cf16f8d2…` SE, `a45e7993…` E, `244255da…` W, `984f954e…` SW).
- idle S/SE/E/W/SW refeito em v3 no grupo `4d0ad963-1052-40a3-9f32-a0058c3bec64`. Usados:
  S `51b78e2d…`, E `25e14261…`, W `c05d5d16…`, SE `93cf71bd…` (2ª tentativa), SW `ad295cf6…`.
  SE 1ª tentativa (`2d68d0fd…`) descartada: olhos semicerrados.
  A 1ª tentativa de S/E/W (`c56a77a5…`, `2db6ec7b…`, `eafa112a…`) foi descartada: olhos fechados e, no E, mão na boca.
- As versões antigas (template) e as descartadas continuam no PixelLab dentro dos mesmos grupos: o
  `delete_animation` só apaga por grupo+direção, e isso apagaria também as novas. Os arquivos locais e
  o sheet valem como fonte oficial; não reexporte o sheet direto do PixelLab sem filtrar essas animações.
- Script de montagem do sheet (local, grátis): `build_sheet.mjs` no scratchpad da sessão. Ele monta a partir
  do sheet anterior, troca as linhas pelos frames novos e alinha os pés.

Ataque (`attack`, 2026-09-28), grupo v3 `d3d61456-625d-43f8-99f7-76405698e815` ("attack_punch", 6 frames + referência = 7):
- Usados: S `624e86c5…` (2ª tentativa; frames 0,2,3,4,5,6,2, porque a geração termina com o braço esticado),
  SE `4d9aba62…`, E `ae34eaca…`, NE `37b4d6d6…` (2ª), N `e7236729…`, NW `509a310a…` (2ª), W `1c6831fd…` (2ª),
  SW `6ba422df…`. Todos os outros usam os frames 0-6 na ordem.
- Descartados (continuam no mesmo grupo no PixelLab): S `98b6afdd…` (soco quase invisível de frente), NE `bae2e07f…`
  e W `1d6560e1…` (vira de frente para a câmera no meio do golpe), NW `dcd77fe3…` (aparece um objeto redondo, tipo escudo).
- Grupo antigo `attack` `80948de8-39a0-491b-97ad-ad0ace084d38` (6 frames, gerado em 2026-09-27 e nunca registrado): não usar.
  Cada direção inventou uma arma diferente (lança, machado, gancho, adaga, orbe).
- Alinhamento: cada direção é deslocada inteira pelo frame 0 (pose de referência) para o pé ficar em y=74. Os frames
  seguintes mantêm o passo/agachamento (pé entre y=70 e 75). As linhas 0-16 não foram alteradas (verificado pixel a pixel).
- Script (local, grátis): `append_attack.py` no scratchpad da sessão.

Arquivos:
- `aprendiz_sheet.png` + `aprendiz_sheet.json` — sprite sheet completo (recomendado para o Phaser).
- `rotations/<direção>.png` — rotações 64x64.
- `animations/attack/<direção>/frame_000-006.png` — 88x88, já com o deslocamento do sheet, na ordem final.
- `animations/<idle|walk>/<direção>/frame_NNN.png` — frames avulsos. Os novos (v3) são 88x88. Os que não foram
  trocados (walk S/N/NE/NW, idle N/NE/NW) mantêm o tamanho original.
- `metadata.json` — metadados do export original (não reflete a troca de animações).

## Gosma (monstro, inspirado no "Poring")

| Campo | Valor |
|---|---|
| ID PixelLab | `b7964906-099d-4f7d-88dd-3f2642932ecd` |
| Tamanho base | 48x48 (monstro ocupa 42x34 px, vista sul; ~metade da altura do Aprendiz) |
| Célula do sprite sheet | 60x60 (sheet 480x540) |
| Direções | 8 |
| Pasta | `public/assets/monsters/gosma/` |

Animações:

| Nome | Frames | Linhas no sheet | Observação |
|---|---|---|---|
| (rotações) | 8 (1 por direção) | 0 | pose parada |
| `idle_bounce` | 8 | 1-8 | pulinho no lugar (v3); serve também como "andar" saltitando |

Arquivos:
- `gosma_sheet.png` + `gosma_sheet.json` — sprite sheet completo.
- `rotations/<direção>.png` — rotações 48x48.
- `animations/idle_bounce/<direção>/frame_NNN.png` — frames avulsos (56x56 ou 60x60).
- `metadata.json`.

Descartado: "Gosma v2" (`17b972b4-95f3-47ef-b7ce-69f399e42d90`) — tom marrom e base com "tentáculos"; não usar.

## Plumito (monstro pássaro/nuvem)

| Campo | Valor |
|---|---|
| ID PixelLab | `ddc2089e-2ef0-4b24-99f4-bd755e89ad60` |
| Tamanho base | 48x48 |
| Célula do sprite sheet | 68x68 (sheet 544x612) |
| Direções | 8 |
| Pasta | `public/assets/monsters/plumito/` |

Animações:

| Nome | Frames | Linhas no sheet | Observação |
|---|---|---|---|
| (rotações) | 8 (1 por direção) | 0 | pose parada |
| `hop_fly` | 8 | 1-8 | voo flutuante/pulinho (v3) |

Arquivos:
- `plumito_sheet.png` + `plumito_sheet.json` (ou `Plumito-Idle.png`).
- `rotations/<direção>.png`.
- `animations/hop_fly/<direção>/frame_NNN.png`.
- `metadata.json`.

## Cascudo (monstro tatu/pedra)

| Campo | Valor |
|---|---|
| ID PixelLab | `3b9c3a7f-47e7-459f-82ab-753810f4fb9d` |
| Tamanho base | 56x56 |
| Célula do sprite sheet | 76x76 (sheet 608x684) |
| Direções | 8 |
| Pasta | `public/assets/monsters/cascudo/` |

Animações:

| Nome | Frames | Linhas no sheet | Observação |
|---|---|---|---|
| (rotações) | 8 (1 por direção) | 0 | pose parada |
| `walk` | 8 | 1-8 | caminhada em 8 direções |

Arquivos:
- `Cascudo-Idle.png` + `Cascudo-Idle.json`.
- `metadata.json`.

---

## Consumo de gerações

| Data | Asset | Gerações |
|---|---|---|
| 2026-09-27 | Aprendiz (v3) + idle/walk + correções das direções norte | 25 |
| 2026-09-27 | Gosma (v3) + idle_bounce + tentativa v2 descartada | 14 |
| 2026-09-27 | Plumito (v3) + hop_fly (8 direções) | 16 |
| 2026-09-27 | Cascudo (v3) + walk (8 direções) | 18 |
| 2026-09-27 | Aprendiz: walk v3 SE/E/W/SW (4) + idle v3 S/SE/E/W/SW (5) + 2ª tentativa idle S/E/W (3) + 2ª tentativa idle SE (1) | 13 |
| 2026-09-28 | Aprendiz: attack v3 8 direções (8) + 2ª tentativa NE/NW (2), S (1), W (1) | 12 |
| 2026-09-27 | Aprendiz: grupo `attack` antigo (descartado, não registrado na época; estimado 1/direção) | ~8 |
| | **Total** | **~106** |
