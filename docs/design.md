# Documento de Design

Nomes marcados com (provisório) ainda podem mudar.

## Conceito
**Mundo:** um arquipélago de ilhas-cidade que flutuam sobre um mar de nuvens. Cada ilha tem clima,
visual e tileset próprios (ex.: ilha-feira, ilha-floresta, ilha-mecânica).

**Poder:** os Espíritos Animais habitam as ilhas. Aventureiros começam como **Aprendiz** e, ao
provar seu valor, firmam um **Pacto** com um espírito — é isso que define a classe.

**Tom:** leve, colorido e aventureiro (Trickster), com a melancolia doce das cidades de RO.

## Pilares
1. Progressão por Pactos (classes animais) e stats estilo RO.
2. Coleção: Selos de monstros e bestiário.
3. Ilhas marcantes para explorar.

## Classes (Pactos)
Aprendiz → Pacto com 1 de 4 espíritos → 2 especializações cada (Marco 3+). Proposta inicial (provisório):
| Espírito | Estilo |
|---|---|
| Raposa | ágil, crítico, esquiva |
| Urso | tanque, corpo a corpo |
| Coruja | magia, área |
| Falcão | distância |

### Visual dos Pactos
Firmar um Pacto troca o **traje** do personagem: é a recompensa visível da classe. O rosto e as proporções
do Aprendiz se mantêm (mesma pessoa, roupa nova); o traje carrega o espírito na silhueta e na paleta.
| Espírito | Traje (provisório) |
|---|---|
| Raposa | capuz com orelhas de raposa, faixa-cauda de tecido, laranja/creme, braçadeiras leves |
| Urso | ombreiras de pelagem, cinto largo, marrom/verde-musgo, silhueta mais robusta |
| Coruja | manto de penas com capuz, gola alta, azul-noite/lilás, amuleto |
| Falcão | capa curta de penas, luva de falcoeiro, arco às costas, azul-céu/branco |

- As especializações (Marco 3+) evoluem o mesmo traje (mais detalhe, acessório novo), sem trocar a identidade.
- Ao firmar o Pacto: cena curta em que o espírito envolve o Aprendiz e o traje aparece.
- Produção: o traje é um *state* do personagem Aprendiz no PixelLab (`create_character_state`), com as
  mesmas animações (idle, walk, ataque). Custo estimado ~60 gerações por Pacto.
- Equipamento não aparece no sprite por enquanto (sem paper-doll); só o traje do Pacto muda o visual.

## Stats
STR, AGI, VIT, INT, DEX, LUK (estilo RO). Prévia do efeito antes de confirmar; redistribuição grátis até ~nível 20.

## Monstros
- **Pomi** (provisório): gosma fofa rosa-pêssego, monstro inicial.
- Variantes elementais por recolor (fogo, água, terra, vento) usando `pixelart_workbench`.
- Todo monstro tem `element`, `sealId`, `fragmentsPerKill` nos dados.

## Selos (equivalente às cartas)
Os monstros carregam fragmentos da essência dos espíritos (ver `historia.md`). Cada abate dá fragmentos do Selo
daquele monstro; com N fragmentos o Selo é garantido. Selos encaixam em equipamentos. Regras em
**Fórmulas → Selos e Ressonância**; bestiário em **Fórmulas → Bestiário**.

## Escavação
Não é o centro do jogo. Pode entrar mais tarde como atividade secundária (ex.: o pet fareja tesouros).

## Marcos
**Marco 1 — primeira versão jogável**
- Aprendiz em 8 direções; 1 ilha-cidade + 1 campo, com transição.
- 3 monstros (Pomi + 2), IA simples.
- Controle híbrido: clique para mover/atacar, WASD opcional, segurar clique = auto-ataque.
- HP/SP, EXP, level, stats com prévia, drops, inventário simples.
- Loot legível (brilho por raridade, auto-pickup opcional), números de dano/EXP flutuantes.
- Morte branda: "Fadiga" (−EXP% temporário) e volta ao último ponto seguro.
- Dados já com campos para elemento, Selo, fragmentos e raridade.

**Marco 2** (escopo aprovado em 27/09/2026, orçamento ~255 gerações):
1. Save local (localStorage, versionado), moeda (nome a definir), barra de atalhos 1–8, minimapa, comparação de equipamento.
2. Sensação de combate: ataque do Aprendiz, hit-stop, flash/recuo, fragmentos voando ao HUD, SFX.
3. Selos (`seals.json`, encaixe, grau I–III, ressonância) + bestiário progressivo (tecla B).
4. Variantes elementais + "Brilhantes" raros por recolor.
5. Vila Brisa viva: Mercador, Seladora, Guardiã do Santuário, Pedra de Retorno.
6. Segundo campo (nível 6–12) com 3 monstros e chefe de campo.
7. Pacto da Raposa: prova, traje, 4 skills + 2 do Aprendiz, mecânica "Rastro", Espírito Companheiro.
   - **Vila Brisa viva (item 5):** Mercador (compra/venda, barraca na praça), Seladora (encaixa e remove Selos,
     perto do Santuário), Guardiã do Santuário (inicia a prova do Pacto, fala da história), Pedra de Retorno
     (objeto: salva o ponto seguro e teleporta entre pedras já ativadas).
   - **Segundo campo (item 6): Bosque Sussurrante** (provisório) — mata de bambu e musgo com riachos e
     cogumelos grandes, luz verde-dourada; liga ao campo de pêssego por ponte. Nível 6–12.
     Monstros (provisório): **Cogumelim** (terra, passivo, pula e solta esporos), **Zunzum** (vento,
     vespa-flor, agressivo, rápido e frágil), **Musgolento** (água, tartaruga de musgo, lento e resistente).
     Chefe de campo: **Tronco-Rei** (terra, toco ancião com coroa de cogumelos; reaparece a cada ~10 min,
     ataque em área telegrafado, drop garantido de Selo parcial).
Transversal: mar de nuvens animado (parallax, nuvens em movimento) para as ilhas parecerem flutuar.
**Marco 3+:** 4 Pactos e especializações, pet, eventos de campo, multiplayer.

## Fórmulas
Implementadas como funções puras em `src/systems/` (testes em `*.test.ts`). Dados em `src/data/`.
`floor` = arredonda para baixo. Stats "efetivos" = distribuídos + bônus de classe + bônus de equipamento.

### Pontos de stat (`stats.ts`)
- Todos os stats começam em 1, máximo 99. Pontos iniciais: **30**.
- Custo para subir um stat do valor `x` para `x+1`: `floor((x−1)/10) + 2` (2 pts até 10, 3 até 20, 4 até 30…).
- Pontos ganhos ao chegar no nível `L`: `floor(L/5) + 3`. Subindo vários níveis de uma vez, `addExp` soma os de cada
  nível (`statPointsGained`); é o que o anúncio de level up mostra (evento `levelUp` traz `level` e `statPoints`).
- Pontos livres = total acumulado até o nível − custo dos stats atuais (não precisa salvar separadamente).
- `previewStats` mostra antes/depois sem aplicar; distribuição inválida (pontos insuficientes, >99, negativos) é recusada.
- Redistribuição: grátis até o **nível 20** (volta tudo a 1 e devolve os pontos); depois exigirá item/NPC.

### Atributos derivados (`stats.ts`)
| Atributo | Fórmula |
|---|---|
| HP máx. | `floor((baseHp + (L−1)·hpPerLevel) · (1 + VIT/100)) + HP equip` |
| SP máx. | `floor((baseSp + (L−1)·spPerLevel) · (1 + INT/100)) + SP equip` |
| ATK | `P + floor(P/10)² + floor(S/5) + floor(LUK/5) + ATK equip` — P = STR e S = DEX (corpo a corpo); invertido para arma à distância |
| MATK | `INT + floor(INT/5)² + MATK equip` |
| DEF | `floor(VIT/2) + DEF equip` |
| MDEF | `floor(INT/2) + floor(VIT/5) + MDEF equip` |
| HIT | `L + DEX + HIT equip` |
| FLEE | `L + AGI + FLEE equip` |
| CRIT % | `1 + floor(LUK·0,3) + CRIT equip` |
| ASPD | `min(190, floor(baseAspd + (4·AGI + DEX)/10))` |
| Intervalo de ataque | `(200 − ASPD) · 20` ms (ASPD 150 = 1 ataque/s; 190 = 5/s) |

Monstros usam `atk/def/hit/flee/aspd` direto dos dados; não critam no Marco 1.

### Dano (`combat.ts`)
1. **Crítico**: `rng·100 < CRIT` → sempre acerta, ignora DEF, dano ×1,4.
2. **Acerto** (se não crítico): chance `80 + HIT − FLEE`, limitada a 5%–95%.
3. **Variação**: `ATK × [0,9 ; 1,1)`.
4. **Defesa**: `dano × 50 / (50 + DEF)` (DEF 50 = −50%), mínimo 1.
5. **Elemento**: multiplica o resultado (mínimo 1).

Tabela elemental — ciclo **fogo → terra → vento → água → fogo** (quem aponta vence):
atacar o elemento que você vence = **×1,5**; atacar o elemento que te vence = **×0,75**; resto (incl. neutro e mesmo elemento) = ×1.

### EXP e nível (`exp.ts`, `data/expTable.json`)
- Nível máximo atual: **30**. EXP para sair do nível `L`: `round(8 · L^2,3 + 12)` (20, 51, 112, 206, 336 … 18.488). EXP é por nível (zera ao subir, excedente passa).
- EXP do abate: `max(1, floor(expBase × penalidadeNível × fadiga))`.
- Penalidade de nível: sem penalidade até o jogador estar 5 níveis acima do monstro; depois −10% por nível, mínimo 10%.
- **Fadiga**: morrer aplica −30% de EXP por **5 minutos**. Morrer de novo só renova o tempo (não acumula). Não há perda de EXP.

### Drops e Selos (`loot.ts`)
- Cada entrada de drop do monstro é rolada independente: cai se `rng < chance × multiplicador` (máx. 100%).
- RNG injetável (`Rng = () => number`); `createSeededRng(seed)` (mulberry32) para testes/replays.
- Selos: cada abate soma `fragmentsPerKill` ao Selo do monstro; com `fragmentsRequired` (seals.json, hoje **100** em todos)
  fragmentos o Selo é garantido e o excedente continua (Pomi: 50 abates; Cascudo: 100).

### Selos e Ressonância (`systems/seals.ts`, dados em `data/seals.json`)
"Equipamento" nos atributos derivados inclui os Selos encaixados e as Ressonâncias ativas (somam como bônus de
equipamento: ATK, DEF, HIT, stats etc., e `maxHp`/`maxSp` fixos depois do multiplicador de VIT/INT).
- **Completar**: um Selo completo entra no **estojo** como grau **I** (o estojo não ocupa slots do inventário).
  O bestiário marca "Selo obtido" para sempre, mesmo que o Selo seja fundido ou encaixado.
- **Fusão**: **3 Selos iguais do mesmo grau → 1 do grau seguinte** (I → II → III; III é o máximo). Manual, na aba
  Selos, para o jogador escolher entre ter vários I (vários encaixes) ou um III. Custo: 50 abates de Pomi = 1 Selo I;
  1 Selo III = 9 Selos I = 450 abates de Pomi. `fusionCost` em seals.json.
- **Encaixes**: `equip.sealSlots` (0–3) em items.json. Hoje: Adaga de Treino 1, Colete de Lona 1. Cada Selo lista os
  slots de equipamento que aceita (`slots`).
- **Encaixar/remover** (grátis): Selos ficam presos ao equipamento **vestido** no slot. Tirar ou trocar o equipamento
  devolve os Selos dele ao estojo (aviso "O Selo voltou ao estojo"); encaixe ocupado + outro Selo = troca.
  A comparação de equipamento já considera que os Selos do item atual saem com ele.
  Funções puras `socketSeal`/`unsocketSeal`/`fuseSeals`/`clearSockets` (sobre `{ stock, sockets }`) e os atalhos
  `socketSealInto`/`removeSealFrom`/`fuseSealStock`/`previewSocket` em `playerState.ts` — a Seladora (item 5) deve
  reusar os mesmos.
- **Ressonância** (`resonances` em seals.json; somam entre si):

| Regra | Condição | Água | Terra | Vento | Fogo |
|---|---|---|---|---|---|
| Eco Elemental | 2+ Selos do mesmo elemento (repetidos contam) | SP +10, MDEF +3 | DEF +4, HP +20 | HIT +4, FLEE +3 | ATK +5 |
| Coro Elemental | 3+ do mesmo elemento (soma com o Eco) | HP +30, SP +15 | DEF +4, VIT +2 | CRIT +3, AGI +2 | ATK +5, STR +2 |

| Regra | Condição | Gosmas | Aladas | Cascos | Flora |
|---|---|---|---|---|---|
| Laço de Família | 2+ Selos **diferentes** da mesma família | HP +25 | HIT +4, FLEE +4 | DEF +3, MDEF +3 | ATK +4, MATK +4 |

- **Selos atuais** (grau I / II / III):

| Selo | Elemento · família | Encaixa em | I | II | III |
|---|---|---|---|---|---|
| Pomi | água · gosma | arma, armadura, acessório | HP +15 | HP +35, VIT +1 | HP +60, VIT +2 |
| Plumito | vento · alada | arma, cabeça | FLEE +3 | FLEE +6, AGI +1 | FLEE +10, AGI +2 |
| Cascudo | terra · casco | armadura, cabeça | DEF +3 | DEF +6, HP +10 | DEF +10, VIT +2 |
| Cogumelim | terra · flora | cabeça, acessório | SP +10, INT +1 | SP +20, MDEF +2, INT +2 | SP +35, MDEF +4, INT +3 |
| Zunzum | vento · alada | arma, acessório | CRIT +2 | CRIT +4, HIT +3 | CRIT +7, HIT +6 |
| Musgolento | água · casco | armadura, acessório | MDEF +3, HP +10 | MDEF +6, HP +25 | MDEF +10, HP +45 |
| Tronco-Rei | terra · flora | arma | ATK +6, STR +1 | ATK +12, STR +2 | ATK +20, STR +3 |

  Pomi aceita arma para o primeiro Selo já caber na Adaga inicial. Os Selos do Bosque (item 6) já existem nos dados
  (ids de monstro `cogumelim`, `zunzum`, `musgolento`, `tronco_rei`); o item 6 só precisa criar os monstros com esses
  ids e `sealId`.

### Bestiário (`systems/bestiary.ts`, `data/bestiary.json`, tecla **B**)
- Entrada por monstro (`bestiary[monsterId] = { kills, sealObtained }`; sem entrada = nunca visto).
- **Visto**: monstro dentro da câmera (checagem a cada 0,5 s; aviso "Novo no Bestiário") ou abatido. Mostra nome,
  sprite, descrição, abates e progresso de fragmentos. Não visto: silhueta e "???".
- **1 abate** (`statsKills`): nível, elemento, comportamento, HP/ATK/DEF/FLEE/EXP.
- **10 abates** (`dropsKills`): drops com chance e faixa de moeda.
- **Selo obtido** (completou ao menos 1): lore curta do Selo (`lore` em seals.json) e efeitos por grau.
- Lista em ordem de nível; janela central (x 270–700, y 70–470). Abrir o Bestiário fecha Status e Inventário e vice-versa.

### Inventário (`inventory.ts`)
- **40 slots**, sem peso. Itens empilham até `maxStack` (99 para consumíveis/materiais, 1 para equipamentos).
- Adicionar completa pilhas existentes antes de ocupar slots vazios; o que não cabe volta como `overflow` (fica no chão).
- Remover é tudo-ou-nada.

### Estado do jogador, regeneração e morte (`gameplay/playerState.ts`)
Constantes em `src/gameplay/config.ts`; kit inicial em `classes.json` (`starter` + `startingKit`).
- Início: classe `starter` (Aprendiz) nível 1, stats em 1 (30 pontos livres), Adaga de Treino equipada, 5 Maçãs-do-Céu.
- Level up cura HP/SP. Pontos novos em VIT/INT entram com o HP/SP extra já preenchido.
- Regeneração fora de combate (5 s sem atacar nem ser atacado), a cada **3 s**:
  HP `max(2, floor(HPmáx/30) + floor(VIT/5))`, SP `max(1, floor(SPmáx/50) + floor(INT/6))`.
  Os relógios de combate/regeneração ficam no estado do jogador: trocar de mapa não reinicia a contagem.
- Morte: no golpe fatal a Fadiga é aplicada na hora e o jogador fica "caído" (HP 0). Depois do efeito visual
  (1,2 s) ele volta ao último ponto seguro e revive com HP/SP cheios. Se chegar a qualquer mapa ainda caído
  (ex.: morreu durante uma transição), é mandado ao ponto seguro. Não perde EXP nem itens.
- Durante a saída de um mapa, a IA e o dano ficam congelados.

### IA de combate (`gameplay/monsterBrain.ts`)
- Passivos só lutam depois de atacados; agressivos perseguem quem entra no `aggroRange`.
- Modos: passeio → perseguir → atacar (no alcance `attackRange`, ritmo `(200 − aspd)·20` ms, 300 ms antes do 1º golpe).
- **Coleira**: raio da área de origem + 6 tiles, medido a partir de onde o monstro nasceu. Desiste e volta para casa se
  passar da coleira, se o jogador ficar a mais de 360 px ou se o jogador cair.
- Voltando para casa: recupera 25% do HP por segundo (cheio ao chegar). Se for atacado com monstro **e** jogador
  dentro da coleira, volta a lutar; senão fica **imune** ("Imune") e o jogador perde o alvo, estilo MMO. Ao desistir,
  troca na hora o caminho de perseguição pelo de volta e recalcula no máximo 1×/s. Prazo para chegar:
  `distância/velocidade × 1,5 + 2 s`; passado o prazo é teleportado para casa quando estiver fora da câmera (à vista,
  só se continuar preso 6 s além do prazo). O jogador também perde o alvo quando o monstro desiste.
- Jogador: alcance corpo a corpo 44 px; ataca no ritmo de `attackDelayMs`.

### Itens no chão
- Drops somem em 60 s. Clique no item para andar até ele e pegar.
- Auto-pegar (tecla P): varre a cada 0,5 s os itens a até 320 px do jogador (inclusive os que já estavam no chão ao
  ligar); com inventário cheio avisa uma vez e continua tentando.

### Interface (`src/ui/`, teclas em `KEYS` de `gameplay/config.ts`)
- Teclas: **C** Status, **I** Inventário, **B** Bestiário, **P** Auto-pegar, **M** som liga/desliga, **-**/**=** volume, **ESC** fecha as janelas. WASD/setas movem (S não abre nada).
- Posições (tela 960×540, jogador no centro): Status encostado à esquerda (x 8–428), Inventário à direita
  (x 658–952); Status em y 140–412 (abaixo do HUD do jogador), Inventário em y 96–454; avisos na faixa de baixo, centralizados e com no máximo 340 px de
  largura; HUD do jogador em y = 32, abaixo do nome do mapa.
- Status: stats base com +/− à esquerda e o custo do próximo ponto `(n)` (vermelho se não der; "+" desabilitado sem
  pontos suficientes ou em `MAX_STAT`), atributos derivados (atual → novo) em duas colunas à direita, botões
  Aplicar / Cancelar / Resetar embaixo. Resetar é grátis até o nível `FREE_RESPEC_MAX_LEVEL` e pede um segundo
  clique ("Confirmar reset?").
- Inventário: grade 5×8 (clique usa/equipa) e coluna "Equipado" com Arma, Armadura, Cabeça e Acessório
  (clique desequipa, se couber no inventário). Ícones sem tint; a raridade aparece na borda do slot (2 px na cor da
  raridade, exceto comum) e no tooltip. Tooltip com fundo, quebra de linha e sempre dentro da tela.
  Cada equipamento vestido mostra um pontinho por encaixe (vazio ou na cor do elemento do Selo).
- Inventário, aba **Selos** (botões "Itens | Selos" no título): "Encaixes" (equipamentos vestidos com encaixe),
  "Estojo" (um Selo por linha, um botão por grau com a quantidade), botão de fusão e Ressonâncias ativas.
  Fluxo: clicar num grau do estojo escolhe o Selo (borda dourada; encaixes que aceitam ficam verdes) → clicar num
  encaixe encaixa (ou troca). Clicar num encaixe ocupado sem Selo escolhido remove. Tooltips mostram efeito, slots e
  a prévia dos atributos ("Ao encaixar …: HP +15").
- As janelas só se reconstroem quando o estado mostrado muda (assinaturas em `ui/uiLogic.ts`).

### Sensação de combate (`systems/feel.ts`, `gameplay/combatFeel.ts`, parâmetros em `data/feel.json`)
Tudo aqui é só visual/sonoro: nenhum timer de gameplay (ASPD, IA, regeneração) depende destes efeitos.
- **Golpe do jogador**: o intervalo de ataque conta do início do golpe (ASPD não muda); o dano sai no **impacto**.
  Duração do golpe = duração natural (animação `attack` do manifesto, ou avanço+volta do lunge) limitada a
  `[minSwingMs, maxSwingMs]` e a no máximo `maxSwingFraction` (85%) do intervalo — com ASPD alto a animação acelera.
  Impacto = `impactFraction` (50%) da animação; sem animação, é o fim da ida do avanço de 5 px na direção do alvo.
  O golpe é cancelado (sem dano) se o jogador andar, trocar/perder o alvo ou o alvo sair do alcance + 16 px.
- **Hit-stop**: congela só as animações do jogador e do alvo (não pausa a cena nem os timers): 55 ms normal,
  85 ms crítico, +20 ms no golpe fatal, máx. 110 ms.
- **Monstro atingido**: flash branco (70 ms + hit-stop) e recuo visual de 3 px (6 px no crítico) na direção do golpe,
  depois do hit-stop. O recuo/avanço mexe só no desenho (origem + offset do corpo juntos), não na posição nem na colisão.
- **Jogador atingido**: tint vermelho leve por 140 ms.
- **Tremida de câmera**: só em crítico (130 ms) ou golpe que tira ≥ 30% do HP máximo do alvo (90 ms, mais fraca).
- **Loot voando**: moeda do abate voa do monstro ao contador de moeda no HUD (1 partícula a cada 4 moedas, máx. 6; o
  contador só sobe quando cada uma chega), fragmentos de Selo voam ao HUD do jogador e itens pegos voam à bolsa no
  canto inferior direito (tecla I).
- **SFX** sintetizados com WebAudio (`audio/sfx.ts`, receitas em `data/sfx.json`, sem arquivos): golpe, crítico, erro,
  dano recebido, morte de monstro, pegar item, moeda (quando chega ao HUD) e level up. Volume global padrão 60%,
  mudo na tecla M; ambos salvos no save.

### Save (`gameplay/save.ts`)
- Versão **3**: `seals` vira estoque por grau (`{ sealId: [I, II, III] }`), mais `equipmentSeals` (encaixes por slot) e
  `bestiary`. Saves v2 migram: cada Selo completo vira grau I, sem encaixes, e o bestiário é deduzido do progresso
  (monstro com fragmentos/Selos = visto; abates = fragmentos totais ÷ `fragmentsPerKill`, um mínimo garantido).
  Ao carregar: Selo/monstro removido do jogo é descartado com aviso; Selo encaixado que não cabe mais (slot não
  aceita, encaixe a menos, equipamento descartado) volta ao estojo com aviso.
- Validação ao carregar (v3), sempre com aviso em vez de invalidar o save: atalhos repetidos na barra (fica o
  primeiro), atalhos de skill com id desconhecido (as skills vêm das classes; nenhuma ainda), EXP acima do necessário
  para o nível (limitada a `necessário − 1`; 0 no nível máximo) e pilha acima de `maxStack` (excedente descartado).
- Save de **versão mais nova** que o jogo: não é carregado nem sobrescrito — o jogo começa um personagem novo com o
  **autosave suspenso** e avisa na tela. Só "Novo jogo" (F10 duas vezes) apaga esse save.
- Versão **2**: acrescenta `settings` (preferências: `audio.volume` 0–1 e `audio.muted`). Saves v1 migram com o padrão.
  Preferências inválidas não invalidam o save: voltam ao padrão com aviso. "Novo jogo" (F10 duas vezes) apaga também as preferências.

### Troca de mapa (intencional, estilo RO)
Ao sair de um mapa, os itens no chão somem e os monstros "resetam" (HP cheio, sem aggro) quando o mapa é recriado.
Só o estado do jogador persiste.
### Referência de balanceamento (Marco 1)
| Monstro | Nível | HP | ATK | DEF | FLEE | EXP | Comportamento |
|---|---|---|---|---|---|---|---|
| Pomi (água) | 1 | 40 | 5 | 0 | 2 | 6 | passivo |
| Plumito (vento) | 3 | 55 | 9 | 2 | 18 | 14 | passivo, esquivo |
| Cascudo (terra) | 5 | 110 | 14 | 15 | 5 | 30 | agressivo (raio 112 px ≈ 3,5 tiles) |

Aprendiz nível 1 com Adaga de Treino (ATK 13) derruba um Pomi em ~4 ataques (~4 s); Pomi precisa de ~8 acertos para derrubar o Aprendiz (HP 40).
Cascudo exige ~nível 5 com STR 10: ~7–8 ataques para matar e ele tira ~13 por golpe.

#### Cascudo: simulação (`systems/balance.ts`, metas travadas em `balance.test.ts`)
`simulateFight` usa as fórmulas reais (acerto, variação, DEF, elemento, ASPD, 300 ms antes do 1º golpe do monstro); o
jogador bate num monstro por vez e todos os monstros vivos batem nele. Sem movimento, regeneração nem poções.
Aprendiz com Adaga de Treino, 2000 lutas por linha:

| Build | HP | vs 1 Cascudo: vitória / HP restante / duração | Tempo para cair só apanhando de 1 / de 3 |
|---|---|---|---|
| Nv 3, STR 10 VIT 5 DEX 6 | 67 | 75% / 13 / 6,2 s | 7,9 s / 2,9 s |
| Nv 3, idem + Colete de Lona | 67 | 81% / 18 / 6,3 s | 9,1 s / 3,2 s |
| Nv 4, STR 10 VIT 6 DEX 6 + Colete | 81 | 98% / 30 / 6,6 s | 11,1 s / 3,9 s |
| Nv 5, STR 11 VIT 7 DEX 6 | 94 | 100% / 42 / 5,9 s | 11,5 s / 4,1 s |

Conclusão: 1 contra 1 já estava na meta (nv 3 vence no limite, nv 5 com folga), então ATK/ASPD ficaram iguais. O
problema do QA (nv 3 de 64 a 0 HP) era puxar **3 Cascudos juntos**: aí qualquer build de nv 3–5 cai em 3–4 s. Correção:
- `aggroRange` 160 → **112 px** (3,5 tiles), para não puxar vizinhos ao lutar; o engine espalha os spawns do campo.
- Fuga: do raio de aggro até o alcance (40 px) o Cascudo leva `(112 − 40) / 40 = 1,8 s`, e o Aprendiz (140 px/s) é
  3,5× mais rápido. Correndo, leva no máximo mais um golpe de cada Cascudo colado e desiste do alvo a 360 px.
- Metas testadas: nv 5 bem distribuído vence ≥ 95% com ≥ 35% do HP; nv 3 ainda corre risco (vence < 95% ou termina
  com < 35% do HP); nv 1 sem stats vence < 20%; aggro ≤ 120 px; chegada ≥ 1,5 s; jogador ≥ 3× mais rápido.
