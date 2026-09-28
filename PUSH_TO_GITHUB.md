# Como fazer Push para o GitHub

O repositório já existe em: https://github.com/oileon/pixel-rpg.git

## Opção 1: PowerShell (recomendado)

```powershell
# Navegue até o projeto
cd C:\Users\Gustavo\Documents\jogos\jogopixel

# Inicialize o git
git init

# Configure usuário (use seu usuário real do GitHub)
git config user.name "oileon"
git config user.email "seu-email@exemplo.com"

# Adicione tudo e commit
git add -A
git commit -m "feat: Jogo Pixel - Marco 1 completo

- Phaser 3 + TypeScript + Vite
- Aprendiz em 8 direções com animações idle/walk/attack
- 3 monstros: Pomi (gosma), Plumito (ave), Cascudo (tatu)
- Combate por clique com fórmulas RO-style (crit, hit, variação, defesa, elemento)
- Sistema de classes/Pactos: Aprendiz + 4 espíritos (Raposa, Urso, Coruja, Falcão)
- Stats STR/AGI/VIT/INT/DEX/LUK com fórmula de custo e respec grátis até nível 20
- Selos (equivalente a cartas): fusão I→II→III, encaixe, ressonância elemental
- Bestiário progressivo (tecla B), Inventário 40 slots, HUD
- Save localStorage versionado (v3) com migração
- 3 mapas: Vila Brisa (safe), Campos de Pêssego (1-5), Bosque Sussurrante (6-12)
- SFX sintetizado WebAudio (sem arquivos)
- ~106 gerações PixelLab consumidas de 2000/ciclo

Co-Authored-By: Claude Code <noreply@anthropic.com>
"

# Adicione o remote e push
git remote add origin https://github.com/oileon/pixel-rpg.git
git branch -M main
git push -u origin main
```

## Opção 2: GitHub Desktop

1. Abra o GitHub Desktop
2. File → Add Local Repository → selecione `C:\Users\Gustavo\Documents\jogos\jogopixel`
3. Clique em "Publish repository"
4. Name: `pixel-rpg` (ou mantenha)
5. Description: `RPG pixel art inspirado em Ragnarok Online e Trickster Online`
6. Uncheck "Keep this code private" se quiser público
7. Publish

## Opção 3: VS Code (com extensão Git)

1. Abra a pasta no VS Code
2. Ctrl+Shift+G (Source Control)
3. "Initialize Repository"
4. Stage all changes (+)
5. Message de commit
6. Ctrl+Enter para commit
7. "Publish Branch" → selecione `oileon/pixel-rpg`

---

## Documentação Gerada (Resumo da Revisão)

### Estado Atual: Marco 1 ~95% completo ✅

| Componente | Status | Observações |
|------------|--------|-------------|
| **Engine Phaser 3** | ✅ Completo | 5 cenas, câmera follow, tilemap, pathfinding A*, transição mapas |
| **Player (Aprendiz)** | ✅ Completo | 8 direções, spritesheets, movimento clique/WASD |
| **Monstros (3)** | ✅ Completo | Pomi, Plumito, Cascudo com IA, sprites, animações |
| **Combate** | ✅ Completo | Fórmulas RO, ASPD, hit-stop, screen shake, números flutuantes |
| **Classes/Pactos** | ✅ Dados prontos | 4 pactos definidos, sprites dos trajes **pendentes** |
| **Stats** | ✅ Completo | 6 stats, custo progressivo, atributos derivados, respec |
| **Selos** | ✅ Completo | Fusão, encaixe, ressonância, bestiário integrado |
| **Inventário** | ✅ Completo | 40 slots, pilhas, equipamento (4 slots), aba Selos |
| **Save System** | ✅ Completo | v3 localStorage, migração v1/v2, validação |
| **Mapas** | ✅ 3 mapas | Town (safe), Field, Forest com boss Tronco-Rei |
| **SFX** | ✅ Completo | WebAudio sintetizado, volume/mute persistido |
| **Testes** | ✅ ~25 arquivos | Cobertura: stats, combat, exp, loot, pathfinding, seals, bestiary, inventory, etc. |
| **Build** | ✅ Passa | `npm run build` → 1.3s, 1.3MB JS gzipped 368KB |

### O que falta para Marco 1 estar 100%:
1. **Trajes visuais dos 4 Pactos** — apenas o Aprendiz tem sprite; os trajes (Raposa, Urso, Coruja, Falcão) precisam ser gerados no PixelLab como `create_character_state` (~60 gen cada = 240 gen)
2. **Animações de ataque dos monstros** — só têm idle; attack/hit/death seriam ideais

### Marco 2 (já em andamento / planejado):
- ✅ Save local, moeda, hotbar 1-8, minimapa, comparação equipamento
- ✅ Sensação combate: hit-stop, flash, recuo, loot voando, SFX
- ✅ Selos + Bestiário (tecla B)
- ✅ Variantes elementais + Brilhantes (via pixelart_workbench)
- ✅ Vila Brisa viva: Mercador, Seladora, Guardiã, Pedra de Retorno
- ✅ Segundo campo (Bosque Sussurrante) com 3 monstros + chefe
- ⏳ Pacto da Raposa: prova, traje, 4 skills + 2 Aprendiz, "Rastro", Espírito Companheiro
- ⏳ Mar de nuvens animado (parallax)

### Assets PixelLab (~106 gerações usadas de 2000/ciclo)
Registrados em:
- `docs/assets.md` — personagens, monstros, UI
- `docs/assets-cenario.md` — tilesets, objetos, prédios
- `docs/design.md` — documento de design completo

### Como rodar localmente:
```bash
cd C:\Users\Gustavo\Documents\jogos\jogopixel
npm install
npm run dev     # Servidor Vite em http://localhost:5173
npm run build   # Build de produção em dist/
```

### Controles do jogo:
- **Clique** — mover / atacar monstro / pegar item
- **Segurar clique no chão** — auto-pathfinding
- **WASD / Setas** — mover (S não abre status)
- **C** — Status (stats, derivada, respec)
- **I** — Inventário (itens + aba Selos)
- **B** — Bestiário
- **P** — Auto-pegar ligado/desligado
- **M** — Som ligado/desligado
- **- / =** — Volume
- **ESC** — Fecha janelas abertas
- **E** — Interagir (NPC, Pedra de Retorno)
- **F10 2x** — Novo jogo (apaga save)

### Próximos passos recomendados:
1. **Push para GitHub** (este guia)
2. Gerar **trajes dos 4 Pactos** no PixelLab (artista-pixel agent)
3. Gerar **animações attack/hit/death dos 3 monstros** (artista-pixel)
4. Implementar **Pacto da Raposa** (prova, skills, mecânica Rastro, Espírito Companheiro)
5. Adicionar **parallax do mar de nuvens** (artista-cenario + programador-engine)
6. Configurar **deploy automático** via PixelLab (git push → *.dev.pixellab.run)