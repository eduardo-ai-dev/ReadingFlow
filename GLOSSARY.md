# ReadingFlow

Biblioteca pessoal digital individual para organizar livros físicos, e-books e audiobooks, acompanhar leituras, metas e desejos sem rede social.

## Linguagem do Domínio

### Catálogo Bibliográfico

**Obra (`Work`)**:
A criação intelectual literária abstrata (ex.: _Dom Casmurro_, de Machado de Assis), independente de editora, tradução, capa ou mídia. Concentra a avaliação geral do leitor e evita contar o mesmo título duas vezes em obras únicas.
_Avoid_: Livro genérico, item, produto

**Edição (`Edition`)**:
Uma publicação concreta de uma Obra, caracterizada por ISBN-13, editora, idioma, formato (`hardcover`, `paperback`, `pocket`, `ebook`, `audiobook`, `box`) e extensão em páginas ou duração em segundos.
_Avoid_: Versão, variante

**Contribuidor (`Contributor`)**:
Pessoa associada a uma Obra ou Edição com papel explícito (`author`, `translator`, `illustrator`, `narrator`, `editor`, `organizer`).
_Avoid_: Criador genérico

**Catálogo Global**:
Conjunto de Obras e Edições compartilhadas (`owner_id` nulo), alimentado apenas pelo servidor a partir de fontes externas ou curadoria.
_Avoid_: Acervo público

**Entrada Privada**:
Obra ou Edição cadastrada ou editada manualmente pelo leitor (`owner_id` preenchido), visível exclusivamente para ele.
_Avoid_: Rascunho

**Impressão Digital (`Fingerprint`)**:
Chave normalizada composta por título sem acentos/pontuação, primeiro autor normalizado e idioma, usada para detectar provável duplicidade quando não há ISBN.
_Avoid_: Hash de arquivo

### Acervo e Aquisição

**Exemplar (`LibraryItem`)**:
A cópia específica de uma Edição que pertence (ou pertenceu) ao acervo do leitor, guardando estado de posse, estante, data de aquisição, valor pago e condição. Separado da Leitura: possuir um exemplar não significa tê-lo lido.
_Avoid_: Livro lido, `user_book`

**Estante (`Shelf`)**:
Agrupador do acervo do leitor classificado pela natureza da mídia (`physical`, `digital`, `audio`), exibido em lista ou grade 2D no R0 (e opcionalmente em 3D no R1).
_Avoid_: Pasta, categoria

**Item de Desejo (`WishlistItem`)**:
Intenção registrada de adquirir uma Obra (qualquer edição) ou uma Edição específica, com prioridade de 1 a 5 e preço-alvo opcional. Ao ser comprado, gera um Exemplar na estante correspondente em operação atômica.
_Avoid_: Favorito, carrinho

### Trajetória de Leitura e Metas

**Leitura (`Reading`)**:
Uma passagem completa ou parcial do leitor por uma Obra, com estado próprio (`not_started`, `reading`, `paused`, `finished`, `abandoned`), datas no fuso horário do perfil e progresso em páginas, porcentagem ou segundos.
_Avoid_: Sessão avulsa, posse

**Releitura (`Reread`)**:
Nova entidade de Leitura aberta para uma Obra que já possui ao menos uma Leitura concluída anteriormente, preservando integralmente o histórico e a nota da Obra.
_Avoid_: Reset de leitura

**Abandono (`Abandoned`)**:
Interrupção deliberada de uma Leitura antes da conclusão, com motivo opcional; não contabiliza como livro lido e pode ser retomada posteriormente.
_Avoid_: Exclusão de leitura

**Meta de Leitura (`ReadingGoal`)**:
Objetivo quantitativo anual ou mensal (em livros ou páginas no R0) acompanhado por ritmo necessário e situação em linguagem neutra (`ahead`, `on_track`, `behind`) dentro de uma margem de tolerância.
_Avoid_: Desafio punitivo, streak obrigatório

**Avaliação (`Review`)**:
Nota única por Obra atribuída pelo leitor de `0.5` a `5.0` em incrementos de meia estrela, acompanhada opcionalmente de nota separada para a narração em audiobooks.
_Avoid_: Comentário público
