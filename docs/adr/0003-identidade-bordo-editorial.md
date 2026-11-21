# Identidade visual "1. Biblioteca Clássica" e sistema tipográfico editorial

Adotamos a paleta **1. Biblioteca Clássica** — Bordô (`#8C2A40`), Couro (`#6A3F28`), Latão (`#D4B27A`) e Papel (`#F1E6D8`) — em substituição à paleta provisória da especificação inicial, obedecendo a quatro regras:

1. **Fundos neutros quentes** em vez de branco puro (`#FFF`) ou preto puro (`#000`): papel `#F1E6D8` no tema claro e charuto `#191412` / madeira `#231C18` no escuro.
2. **Uma única cor de destaque** (`#8C2A40` nos controles primários de ambos os temas), reservando o latão (`#D4B27A`) exclusivamente para detalhes pequenos (filetes, estrelas, rótulos curtos e foco no escuro).
3. **Sem neon e sem tons de rosa vivo.**
4. **Contraste WCAG 2.2 AA verificado** (>= 4,5:1 em todo par de texto e >= 3,0:1 em bordas e indicadores).

**Lombadas da estante 3D:** variadas entre pedras preciosas e tons terrosos (bordô, verde-garrafa `#1F3B2D`, mostarda `#C49232`, couro `#6A3F28` e azul-marinho `#16313F`), sem repetir família cromática em volumes vizinhos.

**Tipografia (`Fraunces` + `Inter`):**

- **Texto de leitura** (`.prose-reading` — resenhas, notas, citações e sinopses): serifada, `17–18 px`, entrelinha `1,58` e largura máxima de `65ch`, alinhada à esquerda (sem justificar).
- **Títulos de tela:** a mesma serifada em peso `semibold` (`600`), com versaletes (`all-small-caps`, `.editorial-kicker`) restritos a rótulos curtos.
- **Interface** (menus, botões, filtros e tabelas): sem serifa (`Inter`), com algarismos tabulares em tabelas.
- **Lombadas 3D:** título em serifada `semibold`, na vertical de cima para baixo (`writing-mode: vertical-rl; text-orientation: mixed`), conforme o padrão brasileiro.
