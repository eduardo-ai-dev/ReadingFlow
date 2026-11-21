**ESPECIFICAÇÃO DE PRODUTO · VERSÃO 2.0**

**ReadingFlow**

A world of reading, organized.

Biblioteca pessoal digital em 3D para livros físicos, e-books e audiobooks (nome provisório anterior: Projeto Biblioteca)

| **Campo**       | **Informação**                                                                                                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Versão**      | 2.0, consolidada                                                                                                                                                                                                                                                             |
| **Data**        | 06/11/2026                                                                                                                                                                                                                                                                   |
| **Status**      | Rascunho para validação                                                                                                                                                                                                                                                      |
| **Base**        | Especificação original (v1) mais revisão crítica e acréscimos                                                                                                                                                                                                                |
| **O que mudou** | Diagnóstico do original (seção 1); sete módulos novos e cerca de 90 requisitos novos; modelo de dados em quatro camadas com esquema SQL testado; segurança, LGPD e ECA Digital; custos e limites verificados; roadmap com critérios de saída; backlog e critérios de aceite. |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Como ler este documento</strong></p>
<p>Títulos e parágrafos marcados com <strong>NOVO</strong> são acréscimos desta revisão. Em tabelas, linhas com fundo verde-água também são novas. O que não tem marcação vem do documento original.</p>
<p>A coluna Release indica em que versão cada item entra: R0 (biblioteca funcional em 2D), R1 (estantes 3D), R1.x (evolução) e R2 (futuro).</p></td>
</tr>
</tbody>
</table>

**Sumário**

[1. Resumo da revisão: diagnóstico e acréscimos](#resumo-da-revisão-diagnóstico-e-acréscimos-novo) **NOVO**

[2. Visão do produto e identidade](#visão-do-produto-e-identidade)

[3. Estrutura geral do sistema](#estrutura-geral-do-sistema)

[4. Requisitos funcionais](#requisitos-funcionais)

[5. Requisitos não funcionais](#requisitos-não-funcionais)

[6. Arquitetura técnica](#arquitetura-técnica)

[7. Modelagem do banco de dados](#modelagem-do-banco-de-dados)

[8. Regras de negócio](#regras-de-negócio)

[9. Identidade visual e experiência tridimensional](#identidade-visual-e-experiência-tridimensional)

[10. Telas, navegação e fluxos](#telas-navegação-e-fluxos-novo) **NOVO**

[11. Segurança, privacidade e conformidade](#segurança-privacidade-e-conformidade-novo) **NOVO**

[12. Qualidade, testes e entrega](#qualidade-testes-e-entrega-novo) **NOVO**

[13. Roadmap de desenvolvimento](#roadmap-de-desenvolvimento)

[14. Backlog inicial e critérios de aceite](#backlog-inicial-e-critérios-de-aceite-novo) **NOVO**

[15. Riscos e cuidados](#riscos-e-cuidados)

[16. Sustentabilidade, custos e limites](#sustentabilidade-custos-e-limites-novo) **NOVO**

[17. Indicadores de sucesso](#indicadores-de-sucesso)

[18. Registro de decisões](#registro-de-decisões-novo) **NOVO**

[19. Próximas etapas](#próximas-etapas)

[Apêndice A. Esquema SQL inicial](#apêndice-a.-esquema-sql-inicial-novo) **NOVO**

[Apêndice B. Fontes de dados e integrações](#apêndice-b.-fontes-de-dados-e-integrações-novo) **NOVO**

[Apêndice C. Brief para agentes de código](#apêndice-c.-brief-para-agentes-de-código-novo) **NOVO**

[Apêndice D. Checklist de lançamento](#apêndice-d.-checklist-de-lançamento-novo) **NOVO**

[Apêndice E. Glossário](#apêndice-e.-glossário-novo) **NOVO**

[Apêndice F. Referências](#apêndice-f.-referências-novo) **NOVO**

# 1. Resumo da revisão: diagnóstico e acréscimos **NOVO**

Esta versão consolida o documento original e acrescenta o que faltava para ele virar uma especificação executável. Tudo o que é novo está marcado com **NOVO** (títulos e parágrafos) ou com fundo verde-água (linhas de tabela). O que não tem marcação vem do original, às vezes reorganizado ou reescrito sem mudar a decisão.

## 1.1 Avaliação direta do documento original

O original é um bom roteiro de produto: tem uma ideia clara (biblioteca pessoal 3D, individual e gratuita), separa a obra do livro do usuário, mantém o 3D opcional e manda começar pelos wireframes. Mas ainda não dá para construir a partir dele sem tomar dezenas de decisões no escuro. Os principais problemas, em ordem de gravidade:

1.  **Falta o coração do produto: o progresso de leitura.** Metas, estatísticas, rankings e recomendações dependem de estado de leitura, datas, página atual e releituras, mas nenhum módulo ou requisito cobre isso. Só existe a tabela reading_sessions.

2.  **O modelo de dados não sustenta as próprias regras.** user_books aponta para a obra, não para a edição nem para o exemplar; faltam as tabelas de ligação (autores, gêneros, itens de lista), a entidade “leitura” (necessária para releituras) e a regra de quem pode escrever no catálogo global.

3.  **O MVP está inflado e inconsistente.** Os módulos A a E são “MVP” (inclusive o 3D), mas o roadmap coloca o 3D na Fase 3 e metas e rankings na Fase 4.

4.  **A ativação foi ignorada.** Sem leitura de código de barras, importação em massa e onboarding, cadastrar 200 livros à mão derruba a adoção antes de o 3D aparecer.

5.  **O 3D depende de dados que nenhuma API entrega.** Lombadas, espessura e dimensões quase nunca vêm do catálogo. Faltam o pipeline de lombadas procedurais, o orçamento de desempenho e a alternativa acessível.

6.  **Metas e estatísticas “por página” não valem para audiobooks.** Faltam unidades (páginas, porcentagem, tempo) e regras de contagem (releitura, formato, abandono, fuso horário).

7.  **Segurança, privacidade e legalidade estão só enunciadas.** Faltam políticas RLS concretas, proteção de chaves e cotas, LGPD (direitos do titular, exclusão de conta, menores) e o ECA Digital, em vigor desde março de 2026.

8.  **A premissa “gratuito” esbarra nos planos gratuitos.** O Supabase Free pausa projetos inativos e não inclui backups automáticos; o plano Hobby da Vercel é restrito a uso pessoal e não comercial. Falta plano de custos e de saída (seção 16).

9.  **Não há validação de mercado.** Sem personas, concorrentes (Goodreads, StoryGraph, Skoob) ou hipóteses testáveis, não dá para saber se o 3D retém usuários ou só impressiona na primeira visita.

10. **Faltam qualidade e operação.** Testes, CI/CD, ambientes, observabilidade, acessibilidade mensurável, critérios de aceite e backlog não existem.

11. **As recomendações medem a mesma coisa três vezes.** “Gênero favorito”, “avaliações” e “histórico” se sobrepõem; não há tratamento para usuário novo (cold start) nem explicação da sugestão.

## 1.2 O que foi acrescentado

| **Área**              | **Acréscimo**                                                                                                                                                                | **Seção**   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Produto**           | Problema, hipóteses testáveis, personas, jornadas, concorrentes, não-objetivos e critérios de naming                                                                         | 2           |
| **Módulos**           | Sete módulos novos: leitura e progresso, onboarding e importação, conta e configurações, compartilhamento e exportação, acervo físico e empréstimos, notificações, curadoria | 3, 4        |
| **Requisitos**        | Cerca de 90 requisitos novos, todos com release (R0, R1, R1.x ou R2)                                                                                                         | 4           |
| **Qualidade**         | Metas mensuráveis de desempenho, acessibilidade, disponibilidade, recuperação e custo                                                                                        | 5           |
| **Arquitetura**       | Decisões em aberto com recomendação, pipeline de catálogo, cache e cotas, ambientes, CI/CD, observabilidade, estrutura de pastas                                             | 6           |
| **Dados**             | Modelo em quatro camadas (obra, edição, exemplar, leitura), governança do catálogo, RLS por tabela, funções transacionais e esquema SQL testado                              | 7, Ap. A    |
| **Regras**            | Máquinas de estado, contagem, fórmulas de metas, recomendações refinadas, duplicidade, capas e lombadas, retenção                                                            | 8           |
| **3D e design**       | Tokens e paleta com contraste verificado, especificação do motor 3D, níveis de capacidade, acessibilidade                                                                    | 9           |
| **UX**                | Mapa de rotas, inventário de telas, fluxos críticos e critérios para os wireframes                                                                                           | 10          |
| **Segurança e legal** | Modelo de ameaças, controles, padrões de RLS, checklist LGPD, ECA Digital, resposta a incidentes                                                                             | 11          |
| **Entrega**           | Estratégia de testes, CI/CD, definição de pronto, beta fechado                                                                                                               | 12          |
| **Planejamento**      | Fase 0 de descoberta, critérios de saída, estimativas, marcos, backlog do MVP-0 e critérios de aceite                                                                        | 13, 14      |
| **Negócio**           | Riscos ampliados, custos e limites verificados, plano de contingência, indicadores com fórmula e eventos                                                                     | 15, 16, 17  |
| **Gestão**            | Registro de decisões, próximas etapas, fontes de dados, brief para agentes de código, checklist de lançamento, glossário                                                     | 18, 19, Ap. |

## 1.3 Mapa entre o documento original e esta versão

| **Original**                 | **Esta versão**                  | **Original**               | **Esta versão** |
| ---------------------------- | -------------------------------- | -------------------------- | --------------- |
| §1 Identidade do produto     | §2                               | §7 Regras de negócio       | §8              |
| §2 Estrutura geral           | §3                               | §8 Identidade visual e 3D  | §9              |
| §3 Requisitos funcionais     | §4                               | §9 Roadmap                 | §13             |
| §4 Requisitos não funcionais | §5                               | §10 Riscos                 | §15             |
| §5 Arquitetura técnica       | §6                               | §11 Indicadores de sucesso | §17             |
| §6 Modelagem do banco        | §7                               | §12 Próxima etapa          | §19             |
| Seções inteiramente novas    | §1, §10, §11, §12, §14, §16, §18 | Apêndices                  | A a F           |

## 1.4 Legenda de releases

| **Release** | **Significado**                                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **R0**      | **MVP-0, biblioteca funcional.** Tudo em 2D (lista e grade). É a primeira versão que o dono do projeto consegue usar no dia a dia. |
| **R1**      | **MVP-1, estantes 3D.** O 3D entra como camada opcional sobre os mesmos dados, sempre com alternativa 2D.                          |
| **R1.x**    | **Evolução incremental.** Listas, séries, recomendações, diário, compartilhamento, empréstimos. Pode sair em partes.               |
| **R2**      | **Futuro.** Notificações, modo offline, descoberta fora do acervo, inglês, autenticação em dois fatores.                           |

# 2. Visão do produto e identidade

A recomendação mantida do original é tratar o projeto como uma **biblioteca pessoal digital tridimensional**, voltada tanto para colecionadores de livros físicos quanto para leitores de e-books e audiobooks. O produto não terá como prioridade ser uma rede social. Seu centro será a experiência individual do leitor: organizar, colecionar, acompanhar, descobrir e construir sua própria trajetória literária.

## 2.1 Documento de identidade do produto

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 76%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Item</strong></th>
<th><strong>Definição</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Nome do projeto</strong></td>
<td><strong>ReadingFlow</strong> (decidido em 06/11/2026; antes, “Projeto Biblioteca”). Slogan: “A world of reading, organized.” Par do FinanceFlow, outro projeto do autor. Ver 2.6.</td>
</tr>
<tr class="even">
<td><strong>Proposta de valor</strong></td>
<td>Uma plataforma gratuita que permite construir e administrar uma biblioteca pessoal interativa, reunindo livros físicos, digitais e audiobooks em um único ambiente tridimensional.</td>
</tr>
<tr class="odd">
<td><strong>Público-alvo</strong></td>
<td>Leitores de livros físicos; leitores de e-books; consumidores de audiobooks; colecionadores e organizadores de bibliotecas; pessoas que estabelecem metas e desafios literários.</td>
</tr>
<tr class="even">
<td><strong>Posicionamento</strong></td>
<td>Uma ferramenta de organização e acompanhamento literário, com experiência visual imersiva e recursos inteligentes.</td>
</tr>
<tr class="odd">
<td><strong>Princípios do produto</strong></td>
<td>Gratuito e acessível; personalização; organização; experiência visual; autonomia do usuário; privacidade.</td>
</tr>
<tr class="even">
<td><strong>Princípios acrescentados</strong></td>
<td><p><strong>Dados portáteis:</strong> exportar tudo, a qualquer momento.</p>
<p><strong>Degradação graciosa:</strong> o 3D cai para 2D e a API que falha cai para o cadastro manual.</p>
<p><strong>Sem pressão:</strong> gamificação opcional e desligada por padrão.</p>
<p><strong>Acessibilidade verificável:</strong> WCAG 2.2 nível AA, com teste.</p></td>
</tr>
</tbody>
</table>

## 2.2 Problema e hipóteses a validar **NOVO**

Quem lê em vários formatos tem o acervo espalhado: estante em casa, e-books em lojas e apps diferentes, audiobooks em assinaturas, listas em notas e planilhas. Ninguém responde rápido a “o que eu tenho?”, “o que eu já li?” e “o que leio agora?”. O produto resolve isso em um só lugar e usa a estante 3D como a representação mais fácil de reconhecer desse acervo. O risco é apostar no 3D sem saber se ele é o motivo de alguém voltar. As hipóteses abaixo transformam essa dúvida em teste.

| **ID** | **Hipótese**                                                                                                                                    | **Como testar**                                                                                         | **O que decide**                                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **H1** | Ver o acervo em uma estante realista aumenta o retorno do usuário em 30 dias.                                                                   | Protótipo clicável com 8 a 10 entrevistas; no beta, comparar a retenção de quem usa 3D com quem usa 2D. | Se a Fase 3 (3D) continua ou se encolhe.                                       |
| **H2** | Cadastrar por ISBN ou câmera leva menos de 30 s por livro e pelo menos 85% dos ISBNs brasileiros são resolvidos automaticamente (meta inicial). | Spike técnico com 200 ISBNs reais (acervo do dono do projeto e best-sellers).                           | Provedores, ordem de prioridade e se o MVP precisa de importação por planilha. |
| **H3** | Metas por formato (páginas ou tempo) aumentam a conclusão da meta anual.                                                                        | Teste de usabilidade e acompanhamento no beta.                                                          | Se o módulo D permanece no MVP.                                                |
| **H4** | Pelo menos 40% dos usuários de celular mantêm o 3D ligado depois da primeira semana (meta inicial).                                             | Spike de desempenho e analytics no beta.                                                                | Se o 3D é padrão no celular ou opcional.                                       |
| **H5** | Imagens compartilháveis de estantes e rankings trazem novos usuários.                                                                           | Taxa de compartilhamento e visitas originadas por links.                                                | Prioridade do módulo M.                                                        |

## 2.3 Personas e jornadas **NOVO**

As personas abaixo são hipóteses de trabalho. Devem ser substituídas por perfis reais quando as entrevistas da Fase 0 acontecerem.

| **Persona**                  | **Perfil**                                               | **Necessidade central**                                          | **O que o produto precisa fazer**                                     |
| ---------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Colecionadora de físicos** | Mais de 300 livros em casa, compra em sebos e livrarias. | Saber o que tem, não comprar repetido, achar o livro na estante. | Cadastro rápido por câmera, localização física, aviso de duplicidade. |
| **Leitor de e-books**        | Biblioteca dividida entre lojas e dispositivos.          | Uma visão única do que possui e do que leu.                      | Estante digital, progresso em porcentagem, importação por planilha.   |
| **Ouvinte de audiobooks**    | Lê no deslocamento, assina serviços de áudio.            | Acompanhar progresso por tempo, não por página.                  | Meta em minutos, narrador, estatísticas por formato.                  |
| **Caçador de metas**         | Define desafios anuais e lista tudo o que leu.           | Ver o ritmo, comparar anos, compartilhar resultados.             | Metas com ritmo necessário, rankings, retrospectiva anual.            |

- **Primeiros 5 minutos:** abrir o site, criar a conta, escanear 10 livros e ver a estante.

- **Ritual semanal:** abrir, atualizar o progresso, concluir um livro, avaliar e ver a meta andar.

- **Compra planejada:** lista de desejos, compra, livro aparece na estante certa sem retrabalho.

- **Retrospectiva:** em dezembro, uma imagem com o ano em livros, pronta para compartilhar.

## 2.4 Concorrentes e diferenciais **NOVO**

| **Referência**           | **Força**                                                                                                           | **Lacuna que o ReadingFlow pode explorar**                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Goodreads**            | Maior rede social de leitura; descoberta e resenhas. A API pública deixou de aceitar novos desenvolvedores em 2020. | Pouco foco em acervo físico e organização individual; sem estante realista. |
| **The StoryGraph**       | Estatísticas detalhadas e recomendações por clima de leitura; alguns recursos em plano pago.                        | Foco em leitura e estatística, não em acervo físico e experiência visual.   |
| **Skoob**                | Rede social brasileira de leitores, com estantes e metas.                                                           | Foco social; estante visual limitada (hipótese a confirmar usando o app).   |
| **Libib e LibraryThing** | Catalogação de acervo, código de barras, empréstimos.                                                               | Pouco foco em progresso, metas e experiência visual (hipótese).             |
| **Hardcover e Literal**  | Alternativas recentes, mais modernas, com perfil social.                                                            | Também sociais; vale estudar o modelo de dados de séries (hipótese).        |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Atenção</strong></p>
<p>Esta tabela é uma hipótese de partida, feita sem testar cada produto. Antes de decidir, usar cada um por uma semana e preencher: o que fazem bem, o que cobram, como tratam livros brasileiros e como exportam dados.</p></td>
</tr>
</tbody>
</table>

**Diferenciais pretendidos:** estante 3D como representação do acervo real (físico, digital e áudio); posse separada de leitura; privacidade por padrão; zero assinatura; metas e estatísticas por formato; catálogo pensado para o livro brasileiro.

## 2.5 Fora de escopo **NOVO**

Dizer o que não será feito protege o MVP. Ficam de fora, pelo menos até a versão 2.0:

- Rede social, feed, comentários públicos, seguidores.

- Venda ou troca de livros (marketplace).

- Leitor de e-books embutido (e a questão de DRM) e player de audiobooks.

- IA generativa nas recomendações da primeira versão.

- Aplicativo nativo (o produto nasce como PWA).

- Comparação com outros usuários ou rankings públicos entre pessoas.

## 2.6 Nome e marca **NOVO**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Decisão tomada</strong></p>
<p>O nome é <strong>ReadingFlow</strong>, com o slogan “A world of reading, organized.” e a paleta <strong>Bordô Editorial</strong> (biblioteca clássica: madeira, couro, charuto e jazz, unida à precisão do ecossistema Flow). O nome forma um par com o FinanceFlow: gestão financeira e gestão da biblioteca pessoal. “Reading”, em vez de “Book” ou “Classic”, não prende a marca a um gênero nem a um formato.</p></td>
</tr>
</tbody>
</table>

**Pendências antes de criar a identidade visual:** (1) verificar disponibilidade de domínio (.com.br e .app), perfis nas redes e registro no INPI, porque nada disso foi checado; (2) decidir o idioma do produto, já que o slogan está em inglês e a interface será em português; (3) definir os valores de cor do Bordô Editorial, com contraste calculado (hoje a seção 9.2 ainda traz a paleta da proposta inicial).

# 3. Estrutura geral do sistema

O sistema é dividido em módulos com responsabilidades próprias, todos sobre a mesma base de dados. A plataforma principal reúne conta, perfil, configurações e painel inicial (módulo L). Os nove módulos do original continuam; foram acrescentados sete.

## 3.1 Mapa de módulos

| **Letra** | **Módulo**                    | **Responsabilidade**                                                                      | **Depende de** | **Release inicial** |
| --------- | ----------------------------- | ----------------------------------------------------------------------------------------- | -------------- | ------------------- |
| **A**     | Cadastro e catálogo           | Cadastrar, pesquisar, identificar por ISBN, importar capa e metadados, evitar duplicidade | L              | R0                  |
| **B**     | Estantes                      | Estantes física, digital e de áudio; visão 3D, lista e grade                              | A, J           | R0 (2D), R1 (3D)    |
| **C**     | Lista de desejos              | Aquisições futuras, prioridade, preço, compra com transferência para a estante            | A, B           | R0                  |
| **D**     | Metas e conquistas            | Metas anuais e mensais, ritmo necessário, desafios, conquistas opcionais                  | J              | R0, R1.x            |
| **E**     | Avaliações e rankings         | Notas, rankings, listas temáticas                                                         | A, J           | R0 (notas), R1.x    |
| **F**     | Séries e coleções             | Sagas, volumes ausentes, boxes                                                            | A              | R1.x                |
| **G**     | Recomendações                 | Próxima leitura, sugestões, aleatório                                                     | E, F, H, J     | R1.x                |
| **H**     | Estatísticas                  | Histórico, desempenho, comparativos                                                       | J, D           | R0 (essenciais)     |
| **I**     | Diário literário              | Notas, frases favoritas, impressões                                                       | A, J           | R1.x                |
| **J**     | Leitura e progresso           | Estado de leitura, datas, progresso, sessões, releituras                                  | A              | R0                  |
| **K**     | Onboarding e importação       | Primeiros passos, planilha, câmera, cadastro em lote                                      | A, B           | R0                  |
| **L**     | Conta, perfil e configurações | Login, perfil, privacidade, preferências, exportação e exclusão de conta                  | nenhum         | R0                  |
| **M**     | Compartilhamento e exportação | Imagens de estantes e rankings, links públicos, exportação de dados                       | B, E, H        | R0 (exportar), R1.x |
| **N**     | Acervo físico e empréstimos   | Localização, condição, edições especiais, empréstimos                                     | B              | R1, R1.x            |
| **O**     | Notificações                  | Lembretes opcionais por e-mail ou push                                                    | D, N           | R2                  |
| **P**     | Curadoria e administração     | Mesclar duplicatas, corrigir catálogo, monitorar cotas e custos, feature flags            | A              | R1, R1.x            |

## 3.2 Princípios arquiteturais **NOVO**

- **Banco como fonte da verdade.** A estante 3D é uma representação dos dados, nunca um sistema separado.

- **Módulos por domínio.** Cada módulo tem pasta, regras e testes próprios; o que é compartilhado vai para a base comum.

- **Tecnologia simples primeiro.** Resolver dentro do Postgres (busca, estatísticas, filas leves) antes de adicionar serviços.

- **Privado por padrão.** Nada é visível a outra pessoa sem ação explícita do usuário.

- **Degradação graciosa.** Sem WebGL, 2D. Sem API de catálogo, cadastro manual. Sem internet, leitura do que já foi carregado.

- **Importações repetíveis.** Importar duas vezes o mesmo arquivo não duplica nada.

- **Observável desde o primeiro dia.** Erros, desempenho e custo medidos antes do lançamento.

- **Sem prisão de dados.** Exportação completa e documentada, a qualquer momento.

## 3.3 Releases e critérios de saída **NOVO**

| **Release** | **Objetivo**                                                        | **Escopo**                                                                                                                                           | **Critério de saída**                                                                                          |
| ----------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **R0**      | Biblioteca funcional em 2D, usada no dia a dia pelo dono do projeto | L, A, B (lista e grade), C, J, D (metas anuais e mensais), E (notas e ranking geral), H (essenciais), K (onboarding, planilha, câmera), M (exportar) | 50 livros cadastrados em até 15 min; RLS testada; exportação reimportável; LCP até 2,5 s                       |
| **R1**      | Estantes 3D opcionais                                               | B (3D, lombadas procedurais, alternativa acessível), N (condição, preço pago), P (feature flags, monitoramento de cotas)                             | 30 fps ou mais em celular intermediário com 500 livros; fallback automático; teste de teclado e leitor de tela |
| **R1.x**    | Evolução incremental                                                | D (desafios, conquistas), E (listas), F, G, I, M (imagens, link público), N (empréstimos, localização), P (curadoria)                                | Critérios de aceite de cada módulo; retenção em 30 dias medida no beta                                         |
| **R2**      | Futuro                                                              | O, modo offline, descoberta externa, inglês, 2FA, importações adicionais                                                                             | Decidir com dados do beta                                                                                      |

# 4. Requisitos funcionais

Os requisitos funcionais descrevem o que o sistema deve fazer. A prioridade de cada módulo vem do original; dentro de cada módulo, a coluna **Release** diz em que versão o requisito entra, para evitar que o projeto comece com funcionalidades demais.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Como ler os códigos</strong></p>
<p>RF01 a RF16 mantêm a numeração original. Os demais seguem o padrão RF-&lt;módulo&gt;&lt;número&gt;; os itens do original que não tinham código ganharam um. Linhas com fundo verde-água são acréscimos desta revisão.</p></td>
</tr>
</tbody>
</table>

## Módulo A: Cadastro e catálogo de livros (prioridade alta, MVP)

| **Código** | **Requisito**                                                                                                                                                                    | **Release** |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **RF01**   | Permitir cadastrar livros manualmente.                                                                                                                                           | R0          |
| **RF02**   | Pesquisar livros por título e autor.                                                                                                                                             | R0          |
| **RF03**   | Identificar livros pelo ISBN.                                                                                                                                                    | R0          |
| **RF04**   | Importar automaticamente capa e metadados quando disponíveis.                                                                                                                    | R0          |
| **RF05**   | Permitir editar informações cadastradas.                                                                                                                                         | R0          |
| **RF06**   | Identificar diferentes edições de uma obra.                                                                                                                                      | R0          |
| **RF07**   | Evitar duplicações indevidas (regras na seção 8.6).                                                                                                                              | R0          |
| **RF08**   | Permitir adicionar livros sem ISBN.                                                                                                                                              | R0          |
| **RF-A09** | Ler o ISBN pela câmera (código de barras), com digitação manual como alternativa.                                                                                                | R0          |
| **RF-A10** | Validar ISBN-10 e ISBN-13 (dígito verificador) e normalizar tudo para ISBN-13 antes de consultar qualquer fonte.                                                                 | R0          |
| **RF-A11** | Consultar as fontes em cascata (catálogo interno, cache, provedores externos) com limite de tempo e fallback; a falha de uma fonte nunca bloqueia o cadastro manual (seção 6.5). | R0          |
| **RF-A12** | Registrar contribuidores com papel: autor, tradutor, ilustrador, narrador, organizador.                                                                                          | R0          |
| **RF-A13** | Registrar o formato da edição (capa dura, brochura, bolso, e-book, audiobook, box) e os dados de cada um: páginas ou duração.                                                    | R0          |
| **RF-A14** | Entradas manuais do usuário são privadas por padrão e não alteram o catálogo global.                                                                                             | R0          |
| **RF-A15** | Busca no acervo do próprio usuário tolerante a acentos e a erros de digitação.                                                                                                   | R0          |
| **RF-A16** | Gerar capa tipográfica de reserva quando não houver capa.                                                                                                                        | R0          |
| **RF-A17** | Permitir enviar capa própria e mostrar a origem e a data dos metadados importados, com sobrescrita sem perder o original.                                                        | R1          |

## Módulo B: Estantes tridimensionais (prioridade alta, MVP visual simplificado)

| **Código** | **Requisito**                                                                                                                             | **Release**     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **RF09**   | Criar estante física.                                                                                                                     | R0              |
| **RF10**   | Criar estante digital.                                                                                                                    | R0              |
| **RF11**   | Criar estante de audiobooks.                                                                                                              | R0              |
| **RF12**   | Representar livros visualmente em 3D.                                                                                                     | R1              |
| **RF13**   | Permitir selecionar e abrir um livro.                                                                                                     | R0              |
| **RF14**   | Atualizar a estante automaticamente após a aquisição.                                                                                     | R0              |
| **RF15**   | Permitir personalizar a aparência da estante.                                                                                             | R1 (básico), R2 |
| **RF16**   | Oferecer visualização alternativa em lista e grade.                                                                                       | R0              |
| **RF-B09** | Permitir mais de uma estante por tipo (por exemplo “Sala” e “Quarto”) e mover itens entre estantes do mesmo tipo.                         | R1              |
| **RF-B10** | Ordenar a estante por: manual, título, autor, data de aquisição, data de leitura, série e cor da capa.                                    | R0 (cor: R1)    |
| **RF-B11** | Filtrar e buscar dentro da estante por estado de leitura, gênero, formato, série e etiqueta.                                              | R0              |
| **RF-B12** | Modo 3D opcional com detecção automática da capacidade do aparelho e preferência 2D ou 3D salva na conta.                                 | R1              |
| **RF-B13** | Lombadas procedurais (cor predominante da capa, título, autor; espessura pela quantidade de páginas) quando não houver imagem de lombada. | R1              |
| **RF-B14** | Equivalente acessível do 3D: lista sincronizada, navegável por teclado e leitor de tela.                                                  | R1              |
| **RF-B15** | Reordenar livros arrastando e soltando e também por menu de ações (alternativa sem arrastar).                                             | R1              |
| **RF-B16** | Buscar um livro e levar a câmera 3D até ele, para estantes grandes.                                                                       | R1.x            |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Posse não é leitura</strong></p>
<p>É importante separar a posse do livro do seu progresso de leitura. Um livro pode estar na estante física, por exemplo, e estar concluído, não iniciado ou em andamento. No modelo de dados isso são duas entidades diferentes: o exemplar (posse) e a leitura (progresso).</p></td>
</tr>
</tbody>
</table>

## Módulo C: Lista de desejos (prioridade alta, MVP)

| **Código** | **Requisito**                                                                                                                                           | **Release** |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **RF-C01** | Adicionar livros desejados.                                                                                                                             | R0          |
| **RF-C02** | Definir prioridade de aquisição.                                                                                                                        | R0          |
| **RF-C03** | Registrar preço e orçamento estimado.                                                                                                                   | R0          |
| **RF-C04** | Marcar como comprado.                                                                                                                                   | R0          |
| **RF-C05** | Transferir automaticamente para uma estante.                                                                                                            | R0          |
| **RF-C06** | Consultar histórico de aquisição.                                                                                                                       | R0          |
| **RF-C07** | Desejar a obra (qualquer edição) ou uma edição específica.                                                                                              | R0          |
| **RF-C08** | Ao comprar, informar formato ou edição, preço pago, data, loja, condição e estante de destino (pré-selecionada pelo formato) em uma única ação atômica. | R0          |
| **RF-C09** | Avisar quando o livro desejado já é possuído em algum formato e, na compra, quando a edição já existe na biblioteca.                                    | R0          |
| **RF-C10** | Orçamento por período (mensal ou anual): soma dos preços estimados, gasto efetivo e saldo.                                                              | R1          |
| **RF-C11** | Arquivar um desejo desistido sem apagar o histórico.                                                                                                    | R0          |

## Módulo D: Metas e acompanhamento (prioridade alta, MVP)

| **Código** | **Requisito**                                                                                             | **Release**         |
| ---------- | --------------------------------------------------------------------------------------------------------- | ------------------- |
| **RF-D01** | Definir metas anuais.                                                                                     | R0                  |
| **RF-D02** | Definir metas mensais.                                                                                    | R0                  |
| **RF-D03** | Estabelecer metas de páginas.                                                                             | R0                  |
| **RF-D04** | Criar listas com prazo de conclusão.                                                                      | R1.x                |
| **RF-D05** | Acompanhar livros concluídos e pendentes.                                                                 | R0                  |
| **RF-D06** | Mostrar o percentual de progresso.                                                                        | R0                  |
| **RF-D07** | Calcular o ritmo necessário para atingir a meta (fórmulas na seção 8.4).                                  | R0                  |
| **RF-D08** | Metas por tempo de escuta (minutos) para audiobooks, além de livros e páginas.                            | R1                  |
| **RF-D09** | Regras de contagem por meta: contar releituras? quais formatos? contar abandonados com progresso parcial? | R0 (releituras), R1 |
| **RF-D10** | Situação da meta em linguagem neutra (adiantado, no ritmo, atrasado), com tolerância configurável.        | R0                  |
| **RF-D11** | Ajustar a meta no meio do período preservando o histórico de alterações.                                  | R1                  |
| **RF-D12** | Desafios temáticos (por exemplo “5 clássicos” ou “autoras brasileiras”) como listas com prazo.            | R1.x                |
| **RF-D13** | Conquistas opcionais e privadas, desativáveis; sequência de leitura (streak) desligada por padrão.        | R1.x                |

## Módulo E: Avaliações e rankings (prioridade alta, MVP básico)

| **Código** | **Requisito**                                                                            | **Release** |
| ---------- | ---------------------------------------------------------------------------------------- | ----------- |
| **RF-E01** | Avaliar livros.                                                                          | R0          |
| **RF-E02** | Criar rankings personalizados.                                                           | R1.x        |
| **RF-E03** | Criar listas temáticas.                                                                  | R1.x        |
| **RF-E04** | Definir ordem manual.                                                                    | R1.x        |
| **RF-E05** | Criar ranking geral (automático, pela nota).                                             | R0          |
| **RF-E06** | Manter listas privadas.                                                                  | R0          |
| **RF-E07** | Nota de 0,5 a 5 em passos de meia estrela e, para audiobooks, nota separada da narração. | R0          |
| **RF-E08** | Resenha privada com marcador de spoiler.                                                 | R1.x        |
| **RF-E09** | Reordenação por arrastar com posição fracionária (não reescreve a lista inteira).        | R1.x        |
| **RF-E10** | Etiquetas próprias (por exemplo “leve”, “denso”, “para reler”).                          | R1.x        |

## Módulo F: Séries e coleções (prioridade intermediária)

| **Código** | **Requisito**                                                                                                                                       | **Release** |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **RF-F01** | Identificar séries literárias.                                                                                                                      | R1.x        |
| **RF-F02** | Identificar volumes ausentes.                                                                                                                       | R1.x        |
| **RF-F03** | Mostrar progresso de aquisição.                                                                                                                     | R1.x        |
| **RF-F04** | Mostrar progresso de leitura.                                                                                                                       | R1.x        |
| **RF-F05** | Identificar ordem de publicação e cronológica.                                                                                                      | R1.x        |
| **RF-F06** | Acompanhar boxes e coleções editoriais.                                                                                                             | R1.x        |
| **RF-F07** | Séries editáveis pelo usuário, com origem registrada (fonte externa ou usuário) e total de volumes declarado manualmente quando a fonte não souber. | R1.x        |
| **RF-F08** | Tipos de relação entre obras: principal, pré-sequência, spin-off, novela, antologia.                                                                | R1.x        |
| **RF-F09** | Número de volume decimal (1, 1,5, 2) e mais de uma ordem de leitura.                                                                                | R1.x        |
| **RF-F10** | Box como edição composta: cadastrar o box marca os itens como possuídos.                                                                            | R1.x        |

## Módulo G: Recomendações (prioridade intermediária)

| **Código** | **Requisito**                                                                                                     | **Release** |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | ----------- |
| **RF-G01** | Recomendar livros com base no histórico.                                                                          | R1.x        |
| **RF-G02** | Considerar avaliações anteriores.                                                                                 | R1.x        |
| **RF-G03** | Sugerir livros não lidos da própria coleção.                                                                      | R1.x        |
| **RF-G04** | Priorizar livros da lista de desejos.                                                                             | R1.x        |
| **RF-G05** | Sugerir próximos volumes de séries.                                                                               | R1.x        |
| **RF-G06** | Permitir recomendações aleatórias.                                                                                | R1.x        |
| **RF-G07** | “O que ler agora?”: filtros por tempo disponível, tamanho (páginas ou horas), formato e continuação de série.     | R1.x        |
| **RF-G08** | Explicar cada sugestão em uma frase.                                                                              | R1.x        |
| **RF-G09** | Fila “Próximas leituras” ordenável manualmente.                                                                   | R1          |
| **RF-G10** | Usuário novo (cold start): questionário curto de preferências ou fila manual.                                     | R1.x        |
| **RF-G11** | Botões de feedback (“não me interessa”, “já li”) e pesos configuráveis em controles simples.                      | R2          |
| **RF-G12** | Descoberta fora do acervo, a partir de assuntos e autores das fontes externas, sem usar dados de outros usuários. | R2          |

## Módulo H: Estatísticas (prioridade intermediária)

| **Código** | **Requisito**                                                                                                  | **Release** |
| ---------- | -------------------------------------------------------------------------------------------------------------- | ----------- |
| **RF-H01** | Total de livros lidos.                                                                                         | R0          |
| **RF-H02** | Total de páginas lidas.                                                                                        | R0          |
| **RF-H03** | Média de avaliação.                                                                                            | R0          |
| **RF-H04** | Gêneros mais consumidos.                                                                                       | R1.x        |
| **RF-H05** | Autores mais lidos.                                                                                            | R1.x        |
| **RF-H06** | Livros abandonados.                                                                                            | R0          |
| **RF-H07** | Livros não lidos na coleção.                                                                                   | R0          |
| **RF-H08** | Histórico por ano.                                                                                             | R0          |
| **RF-H09** | Comparativo entre metas e resultados.                                                                          | R0          |
| **RF-H10** | Definição explícita de “página lida” e métricas próprias de audiobook (horas ouvidas).                         | R0          |
| **RF-H11** | Filtro por período (ano, mês, intervalo) usando o fuso horário do usuário.                                     | R0          |
| **RF-H12** | Calendário de leitura (mapa de calor) e tempo médio por livro.                                                 | R1.x        |
| **RF-H13** | Retrospectiva anual (“Meu ano em livros”) compartilhável.                                                      | R1.x        |
| **RF-H14** | Estatísticas do acervo: valor investido (se informado), porcentagem não lida, livros por estante e por década. | R1.x        |

## Módulo I: Diário literário (prioridade futura)

| **Código** | **Requisito**                                                           | **Release** |
| ---------- | ----------------------------------------------------------------------- | ----------- |
| **RF-I01** | Anotações pessoais.                                                     | R1.x        |
| **RF-I02** | Frases favoritas.                                                       | R1.x        |
| **RF-I03** | Comentários por capítulo ou página.                                     | R1.x        |
| **RF-I04** | Registro de impressões.                                                 | R1.x        |
| **RF-I05** | Histórico de releituras.                                                | R1.x        |
| **RF-I06** | Notas privadas por padrão, com Markdown sanitizado na exibição.         | R1.x        |
| **RF-I07** | Busca de texto nas anotações.                                           | R2          |
| **RF-I08** | Importar destaques do Kindle (arquivo de recortes) e associar às obras. | R2          |
| **RF-I09** | Exportar anotações em Markdown.                                         | R2          |

## Módulo J: Leitura e progresso (prioridade alta, MVP) **NOVO**

É o módulo que faltava. Sem ele, metas, estatísticas, recomendações e rankings não têm de onde tirar dados.

| **Código** | **Requisito**                                                                                                     | **Release** |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | ----------- |
| **RF-J01** | Definir o estado de leitura: não iniciado, lendo, pausado, concluído, abandonado, independente da posse.          | R0          |
| **RF-J02** | Registrar datas de início e fim no fuso do usuário, inclusive retroativas.                                        | R0          |
| **RF-J03** | Registrar progresso em páginas, porcentagem ou tempo, conforme o formato, com conversão explícita entre unidades. | R0          |
| **RF-J04** | Permitir várias leituras simultâneas (limite configurável) e uma fila de próximas.                                | R0          |
| **RF-J05** | Releitura: iniciar nova leitura de obra já lida preservando nota e histórico anteriores.                          | R0          |
| **RF-J06** | Abandono com motivo opcional e possibilidade de retomar.                                                          | R0          |
| **RF-J07** | Editar ou desfazer o histórico recalculando metas e estatísticas sem quebrar nada.                                | R0          |
| **RF-J08** | Sessões de leitura (data e quantidade lida) com cronômetro opcional.                                              | R1          |

## Módulo K: Onboarding e importação (prioridade alta, MVP) **NOVO**

A ativação do usuário depende de o acervo entrar rápido. Esse módulo ataca a maior barreira de adoção de qualquer app de biblioteca.

| **Código** | **Requisito**                                                                                                                                                         | **Release** |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **RF-K01** | Onboarding em até 3 passos (objetivo de leitura, formatos que usa, primeiro livro) e estados vazios orientados.                                                       | R0          |
| **RF-K02** | Importar planilha própria (modelo oferecido) e CSV do Goodreads, com pré-visualização, mapeamento de colunas, relatório de erros e importação repetível sem duplicar. | R0          |
| **RF-K03** | Desfazer uma importação inteira (rollback por lote).                                                                                                                  | R0          |
| **RF-K04** | Itens não resolvidos entram em “pendentes de revisão” para o usuário completar.                                                                                       | R0          |
| **RF-K05** | Importar CSV do StoryGraph.                                                                                                                                           | R1.x        |
| **RF-K06** | Cadastro em lote por câmera (modo rajada) e por lista de ISBNs colados.                                                                                               | R1.x        |
| **RF-K07** | Outras origens (Skoob, Kindle, serviços de áudio), apenas por arquivo exportado pelo usuário e se houver formato viável.                                              | R2          |

## Módulo L: Conta, perfil e configurações (prioridade alta, MVP) **NOVO**

| **Código** | **Requisito**                                                                                                                     | **Release** |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **RF-L01** | Cadastro e login por e-mail e senha e por provedor social (por exemplo Google), com verificação de e-mail e recuperação de senha. | R0          |
| **RF-L02** | Perfil com nome de exibição, avatar opcional, idioma, fuso horário e moeda padrão.                                                | R0          |
| **RF-L03** | Privacidade: tudo privado por padrão, com controles explícitos de compartilhamento.                                               | R0          |
| **RF-L04** | Preferências: tema claro, escuro ou do sistema; 3D automático, ligado ou desligado; regra padrão de contagem de releituras.       | R0          |
| **RF-L05** | Exportar todos os dados a qualquer momento (JSON e CSV).                                                                          | R0          |
| **RF-L06** | Excluir a conta e todos os dados, com confirmação e prazo de arrependimento opcional.                                             | R0          |
| **RF-L07** | Aceite versionado dos Termos de Uso e da Política de Privacidade, com data registrada.                                            | R0          |
| **RF-L08** | Painel inicial: lendo agora, metas, próximas leituras, atividade recente.                                                         | R0          |
| **RF-L09** | Ver sessões ativas e encerrar a sessão em todos os dispositivos.                                                                  | R1          |
| **RF-L10** | Autenticação em dois fatores opcional.                                                                                            | R2          |

## Módulo M: Compartilhamento e exportação (prioridade intermediária) **NOVO**

O original decide manter o projeto sem comunidade, mas permitir exportar e compartilhar imagens de estantes e rankings. Nenhum requisito cobria isso.

| **Código** | **Requisito**                                                                                       | **Release** |
| ---------- | --------------------------------------------------------------------------------------------------- | ----------- |
| **RF-M01** | Exportar a biblioteca em CSV (abre em planilha) e em JSON completo (backup reimportável).           | R0          |
| **RF-M02** | Gerar imagem da estante ou de um ranking, com opção de ocultar capas, notas e preços.               | R1.x        |
| **RF-M03** | Link público somente leitura, revogável, com token imprevisível e validade opcional.                | R1.x        |
| **RF-M04** | Imagem da retrospectiva anual.                                                                      | R1.x        |
| **RF-M05** | Padrão seguro: nenhuma informação pessoal, preço ou nota nas imagens, a menos que o usuário marque. | R1.x        |

## Módulo N: Acervo físico e empréstimos (prioridade intermediária) **NOVO**

| **Código** | **Requisito**                                                                                          | **Release** |
| ---------- | ------------------------------------------------------------------------------------------------------ | ----------- |
| **RF-N01** | Estado de posse do exemplar: possuído, emprestado, vendido, doado, perdido; o histórico não some.      | R1          |
| **RF-N02** | Condição do exemplar, edição especial (autografado, primeira edição, colecionador), preço pago e data. | R1          |
| **RF-N03** | Localização física (cômodo, estante, prateleira).                                                      | R1.x        |
| **RF-N04** | Empréstimos: emprestei ou peguei emprestado, com quem, data, prazo e devolução.                        | R1.x        |
| **RF-N05** | Lembretes de devolução opcionais.                                                                      | R2          |

## Módulo O: Notificações (prioridade futura) **NOVO**

| **Código** | **Requisito**                                                                                                   | **Release** |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ----------- |
| **RF-O01** | E-mail ou push opcionais: lembrete de meta, devolução de empréstimo, resumo semanal; tudo desligado por padrão. | R2          |
| **RF-O02** | Preferências granulares e cancelamento em um clique.                                                            | R2          |

## Módulo P: Curadoria e administração (prioridade intermediária) **NOVO**

Um catálogo global sem moderação vira bagunça. Este módulo é o mínimo para operar o produto sem perder o controle dos dados e dos custos.

| **Código** | **Requisito**                                                                                                                                                          | **Release** |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **RF-P01** | Feature flags para liberar o 3D e os módulos por etapa.                                                                                                                | R1          |
| **RF-P02** | Monitoramento de cotas das APIs externas e de custos, com alertas.                                                                                                     | R1          |
| **RF-P03** | Painel administrativo mínimo (pode começar em scripts e no painel do Supabase): mesclar duplicatas, corrigir metadados, promover entradas privadas ao catálogo global. | R1.x        |
| **RF-P04** | Fila de sugestões de correção enviadas por usuários.                                                                                                                   | R2          |
| **RF-P05** | Registro de auditoria das ações administrativas.                                                                                                                       | R1.x        |

# 5. Requisitos não funcionais

Além das funcionalidades, existem características técnicas que o sistema precisa respeitar. A coluna “Meta” é acréscimo desta revisão: são alvos de projeto, a confirmar nos spikes da Fase 0 e a medir continuamente depois.

| **Requisito**           | **Definição (original)**                                 | **Meta mensurável**                                                                                                                                                                                                                                                                        | **Como verificar**                                                                            |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| **Responsividade**      | Funcionar em computadores, tablets e celulares.          | Mobile-first a partir de 360 px; alvos de toque de 44 por 44 px (mínimo absoluto de 24 por 24, WCAG 2.2 critério 2.5.8).                                                                                                                                                                   | Testes Playwright em viewports de celular, tablet e desktop; teste em 3 aparelhos reais.      |
| **Desempenho**          | Carregar estantes e catálogos sem lentidão excessiva.    | Nas telas 2D, no percentil 75: LCP até 2,5 s, INP até 200 ms, CLS até 0,1. JS inicial das rotas 2D até 200 KB gzip (alvo). Listas com mais de 100 itens virtualizadas. 3D: 30 fps ou mais em celular intermediário e 60 fps em desktop com 500 livros visíveis (alvos a validar no spike). | Lighthouse CI no pull request; Web Vitals de usuários reais; perfil de quadros do 3D.         |
| **Acessibilidade**      | Navegação por teclado, contraste e alternativas ao 3D.   | WCAG 2.2 AA; contraste de 4,5:1 no texto e 3:1 em componentes; respeitar prefers-reduced-motion; alternativa em lista equivalente ao 3D.                                                                                                                                                   | axe-core automatizado; revisão manual com NVDA, VoiceOver e TalkBack.                         |
| **Segurança**           | Senhas protegidas, autenticação e controle de acesso.    | RLS em 100% das tabelas com teste automatizado; segredos só no servidor; checklist OWASP ASVS nível 1; rate limit em busca, ISBN e importação.                                                                                                                                             | Testes pgTAP de RLS; varredura de segredos e dependências no CI; revisão antes do lançamento. |
| **Privacidade**         | Dados e listas privadas por padrão.                      | Coleta mínima; analytics sem cookies e sem dados pessoais; exclusão de conta concluída em até 30 dias, backups incluídos (alvo).                                                                                                                                                           | Checklist LGPD (seção 11.4); teste de exclusão ponta a ponta.                                 |
| **Escalabilidade**      | Suportar crescimento de usuários e coleções.             | Premissa de projeto: 10 mil usuários, 2 milhões de linhas em exemplares e leituras e 100 mil edições no catálogo, sem mudar a arquitetura.                                                                                                                                                 | Teste de carga com dados sintéticos; plano de consultas (EXPLAIN) das telas principais.       |
| **Compatibilidade**     | Funcionar nos navegadores modernos.                      | Duas últimas versões estáveis de Chrome, Edge, Firefox e Safari (desktop e celular); WebGL2 com fallback automático para 2D.                                                                                                                                                               | Matriz de testes E2E; detecção de capacidade em tempo de execução.                            |
| **Disponibilidade**     | Preservar os dados e oferecer mecanismos de recuperação. | Meta de 99% ao mês (melhor esforço); RPO de até 24 h; RTO de até 8 h.                                                                                                                                                                                                                      | Monitor externo; restauração de backup testada todo trimestre.                                |
| **Portabilidade**       | Permitir exportação dos dados pessoais.                  | Exportação completa em JSON e CSV, formato versionado e reimportável.                                                                                                                                                                                                                      | Teste de ida e volta (exportar, apagar, importar, comparar).                                  |
| **Internacionalização** | Não havia.                                               | pt-BR primeiro; textos externalizados desde o início; datas, moeda e plural localizados.                                                                                                                                                                                                   | Revisão de strings; teste com um segundo idioma de teste.                                     |
| **Observabilidade**     | Não havia.                                               | Erros e desempenho rastreados; logs estruturados sem dados pessoais; alertas para erro 5xx, cota de API e custo.                                                                                                                                                                           | Painel e alertas configurados antes do beta.                                                  |
| **Manutenibilidade**    | Não havia.                                               | TypeScript estrito; lint e formatação automáticos; testes nas regras de negócio; decisões registradas (ADR).                                                                                                                                                                               | Gates no CI; revisão do registro de decisões.                                                 |
| **Resiliência externa** | Não havia.                                               | Timeout de 3 a 5 s por provedor; retry com backoff; cache; falha de API nunca bloqueia o cadastro manual.                                                                                                                                                                                  | Testes com provedor simulado fora do ar.                                                      |
| **Usabilidade**         | Não havia.                                               | Primeiro livro cadastrado em até 2 min após criar a conta; adicionar por ISBN em até 30 s (alvos de teste).                                                                                                                                                                                | Teste de usabilidade com 5 pessoas por rodada.                                                |
| **Custo**               | Não havia.                                               | Teto mensal definido; alertas em 50%, 80% e 100%; chave de desligamento (kill switch) para recursos caros.                                                                                                                                                                                 | Painel de custos revisto toda semana no beta.                                                 |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Requisito especialmente importante</strong></p>
<p>O 3D não poderá ser obrigatório. Usuários com celulares mais simples devem conseguir usar a plataforma normalmente, com a mesma funcionalidade, em lista e grade.</p></td>
</tr>
</tbody>
</table>

# 6. Arquitetura técnica

A arquitetura recomendada usa tecnologias modernas e permite começar pequeno e ampliar o sistema sem reconstruí-lo depois.

## 6.1 Stack recomendada

| **Camada**               | **Tecnologia**                       | **Função**                                                                                |
| ------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Interface**            | Next.js + React                      | Estrutura principal do site, navegação e interfaces.                                      |
| **Linguagem**            | TypeScript                           | Tipagem que reduz erros e facilita a manutenção.                                          |
| **3D**                   | Three.js + React Three Fiber         | Construção das estantes tridimensionais e interação com os livros.                        |
| **Dados e autenticação** | Supabase + PostgreSQL                | Banco de dados, autenticação, armazenamento e gerenciamento dos usuários.                 |
| **Hospedagem**           | Vercel (ver decisão D-06)            | Hospedagem e publicação do site.                                                          |
| **Integrações**          | Google Books API, Open Library, ISBN | Títulos, autores, capas, informações editoriais, edições e identificadores.               |
| **Integração adicional** | BrasilAPI (consulta de ISBN)         | Agrega CBL, Mercado Editorial, Open Library e Google Books; útil para livros brasileiros. |

Essas integrações precisam ter mecanismos de fallback: se uma API não encontrar o livro, o usuário ainda poderá cadastrá-lo manualmente. O ponto central é que o banco de dados será a fonte oficial das informações. A estante 3D será uma representação visual dos dados, não um sistema separado: quando alguém compra um livro, o sistema atualiza o registro de aquisição e a estante consulta essa informação e apresenta o novo livro automaticamente.

<img src="media/56846af725ef56c6ac9d6f0868359bbceeb00a31.png" title="Diagrama de arquitetura em camadas: cliente, aplicação, Supabase e serviços externos" style="width:5.625in;height:4.79167in" alt="Diagrama de arquitetura em camadas: cliente, aplicação, Supabase e serviços externos" />

_Figura 1. Arquitetura em camadas. Em verde-água, os componentes acrescentados nesta revisão._

## 6.2 Stack complementar **NOVO**

| **Necessidade**           | **Sugestão**                                                                                              | **Observação**                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Estilo e componentes**  | Tailwind CSS e componentes acessíveis (Radix UI ou shadcn/ui)                                             | Foco, teclado e ARIA já resolvidos nos componentes base.               |
| **Validação**             | Zod, com esquemas compartilhados entre cliente e servidor                                                 | Uma definição única para formulário, API e banco.                      |
| **Dados no cliente**      | TanStack Query, Server Components e Server Actions                                                        | Cache e revalidação; evitar estado global.                             |
| **3D**                    | @react-three/drei, instancing, texturas comprimidas (KTX2), animações com springs                         | Carregar sob demanda; frameloop="demand" poupa bateria.                |
| **Banco e migrações**     | Supabase CLI (migrações em SQL, ambiente local com Docker, tipos TypeScript) e pgTAP para testar RLS      | Ver decisão D-01 sobre ORM.                                            |
| **Busca**                 | Postgres com pg_trgm, unaccent e busca de texto em português                                              | Sem serviço extra no MVP.                                              |
| **Jobs**                  | Supabase Edge Functions com cron (pg_cron) ou Vercel Cron                                                 | Limpeza de cache, importações grandes, conquistas.                     |
| **PWA**                   | Manifesto e service worker; leitura de código de barras com BarcodeDetector e alternativa (ZXing)         | O suporte ao BarcodeDetector varia entre navegadores; prever fallback. |
| **Imagens**               | Redimensionar capas na ingestão (256 e 512 px) e guardar no Storage                                       | Evita custo de transformação sob demanda e resolve o CORS do WebGL.    |
| **Observabilidade**       | Sentry, Web Vitals reais, analytics sem cookies (Plausible, Umami ou PostHog), monitor de disponibilidade | Sem dados pessoais nos eventos.                                        |
| **Qualidade**             | ESLint, Prettier, Vitest, Testing Library, Playwright, axe-core, Lighthouse CI                            | Detalhes na seção 12.                                                  |
| **Cadeia de suprimentos** | Dependabot ou Renovate, auditoria de dependências, detecção de segredos (gitleaks)                        | Detalhes na seção 11.                                                  |
| **Entrega**               | GitHub Actions e prévias por pull request                                                                 | Detalhes na seção 12.                                                  |

## 6.3 Decisões de arquitetura a fechar **NOVO**

Cada decisão tem uma recomendação, mas todas precisam de confirmação do responsável pelo projeto. As decisões fechadas entram no registro da seção 18.

| **ID**   | **Decisão**            | **Opções**                                                    | **Recomendação**                                                                                                                                                                                                                        |
| -------- | ---------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-01** | Acesso a dados         | supabase-js com RLS; ORM (Drizzle, Prisma) com conexão direta | supabase-js com RLS para os dados do usuário; no servidor, consultas parametrizadas ou ORM para o que for complexo. Atenção: conexão direta por ORM ignora a RLS, então a autorização passa a depender do código. Nunca concatenar SQL. |
| **D-02** | Governança do catálogo | Global único curado; por usuário; híbrido                     | Híbrido: catálogo global somente leitura (APIs e curadoria) mais entradas privadas do usuário, com promoção por curadoria.                                                                                                              |
| **D-03** | Capas                  | Hotlink das fontes; cache próprio                             | Cache próprio de miniaturas: o WebGL exige CORS, hotlink é instável e os termos das fontes precisam ser respeitados. Upload do usuário como alternativa.                                                                                |
| **D-04** | Renderização           | Tudo no cliente; Server Components                            | Server Components nas telas 2D; cena 3D em componente cliente carregado dinamicamente, sem SSR.                                                                                                                                         |
| **D-05** | Plataforma             | PWA; app nativo                                               | PWA primeiro (câmera, instalação, offline parcial). Nativo só se o beta provar a necessidade.                                                                                                                                           |
| **D-06** | Hospedagem             | Vercel Hobby ou Pro; Cloudflare; Netlify; VPS                 | Decidir antes de qualquer divulgação pública: o plano Hobby é restrito a uso pessoal não comercial (seção 16).                                                                                                                          |
| **D-07** | Região dos dados       | Exterior; São Paulo                                           | Preferir a região de São Paulo no Supabase e nas funções, por latência e por simplificar a LGPD.                                                                                                                                        |
| **D-08** | Idade mínima           | 13, 16 ou 18 anos                                             | Decidir com apoio jurídico à luz da LGPD (art. 14) e do ECA Digital (seção 11.4).                                                                                                                                                       |
| **D-09** | Telemetria             | Sem analytics; com cookies; sem cookies                       | Analytics sem cookies e sem dados pessoais, com opção de desligar.                                                                                                                                                                      |
| **D-10** | Licença do código      | Privado; código aberto (MIT, AGPL)                            | Decisão do autor; muda o modelo de contribuição e a possibilidade de hospedagem comunitária.                                                                                                                                            |
| **D-11** | Séries                 | Fonte externa; manual; híbrido                                | Manual com sugestão assistida; fonte externa só depois do spike de cobertura.                                                                                                                                                           |

## 6.4 Pipeline de resolução do catálogo **NOVO**

Quando o usuário digita um ISBN ou aponta a câmera, o sistema percorre sempre o mesmo caminho. O desenho garante três coisas: nenhuma chamada externa se o livro já existe, nenhuma falha de API trava o usuário e todo livro que entra passa pela mesma normalização e checagem de duplicidade.

<img src="media/f44871ecb0ace5c9ab4dbcf9b7fc91f5915f8749.png" title="Fluxograma do pipeline de resolução do catálogo, da entrada do ISBN até a atualização da estante" style="width:4.89583in;height:5.20833in" alt="Fluxograma do pipeline de resolução do catálogo, da entrada do ISBN até a atualização da estante" />

_Figura 2. Pipeline de resolução do catálogo._

| **Campo**                    | **Fonte preferida (hipótese)**                                                                                  | **Alternativa**                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Título, autores, editora** | BrasilAPI (CBL e Mercado Editorial) para ISBN dos prefixos 978-85 e 978-65, que identificam edições brasileiras | Google Books; Open Library             |
| **Capa**                     | Open Library ou Google Books, convertida e guardada em cache próprio                                            | Capa tipográfica gerada                |
| **Páginas e dimensões**      | BrasilAPI (dimensões, quando houver)                                                                            | Google Books; valor padrão por formato |
| **Sinopse e gêneros**        | Google Books                                                                                                    | Open Library; edição manual            |
| **Série**                    | Cadastro do usuário                                                                                             | Fonte externa depois do spike          |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Calibrar com dados</strong></p>
<p>A ordem acima é uma hipótese. No spike da Fase 0, consultar 200 ISBNs reais em cada fonte e medir cobertura por campo, tempo de resposta e qualidade (por exemplo, autores em CAIXA ALTA). A ordem final sai dessa medição.</p></td>
</tr>
</tbody>
</table>

## 6.5 Cache, cotas e limites das fontes externas **NOVO**

| **Fonte**            | **Limite ou regra (verificado em 06/11/2026)**                                                                                                                                          | **Consequência no projeto**                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Google Books API** | Cota padrão tipicamente de 1.000 consultas por dia por projeto; confirmar no console do Google Cloud e pedir aumento se necessário.                                                     | Cache agressivo; chave só no servidor; não usar como primeira fonte para tudo. |
| **Open Library**     | Sem identificação, cerca de 1 requisição por segundo; identificando o app no cabeçalho User-Agent (nome e contato), cerca de 3 por segundo. A documentação pede para cachear respostas. | Enviar User-Agent identificado; cachear; fila para importações grandes.        |
| **BrasilAPI (ISBN)** | Serviço gratuito e comunitário que agrega CBL, Mercado Editorial, Open Library e Google Books; sem SLA conhecido.                                                                       | Tratar como conveniência, com fallback direto para as fontes originais.        |

- **Cache:** respostas positivas por 30 dias e negativas por 24 horas na tabela external_lookup_cache (valores iniciais, a ajustar).

- **Requisições simultâneas:** deduplicar chamadas ao mesmo ISBN em andamento.

- **Cotas:** contador diário por provedor, alerta em 80% e desligamento automático do provedor ao esgotar.

- **Resiliência:** timeout de 3 a 5 s, retry com backoff exponencial, fallback para o próximo provedor.

- **Abuso:** limite por usuário (por exemplo 60 consultas por minuto), CAPTCHA no cadastro e limite de linhas por importação.

## 6.6 Ambientes e fluxo de entrega **NOVO**

| **Ambiente** | **Para que serve**               | **Dados**                                      | **Regra**                                              |
| ------------ | -------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| **Local**    | Desenvolvimento                  | Supabase local em Docker, com seed fictício    | Nunca usar dados reais.                                |
| **Prévia**   | Revisão de cada pull request     | Banco de staging                               | URL temporária.                                        |
| **Staging**  | Ensaio de migrações e testes E2E | Dados fictícios (5 mil livros para desempenho) | Espelha a produção.                                    |
| **Produção** | Usuários reais                   | Dados reais                                    | Migração só depois de passar em staging; backup antes. |

Regras comuns: segredos separados por ambiente; migrações versionadas e reversíveis; feature flags para liberar recursos; nunca editar a produção à mão.

## 6.7 Observabilidade, backup e recuperação **NOVO**

- **Logs e métricas:** logs estruturados sem dados pessoais; acompanhar erros 5xx, latência p95, taxa de resolução de ISBN, cota das APIs e custo diário.

- **Alertas e runbooks:** alerta para cada métrica acima, com um passo a passo curto de resposta.

- **Backup:** o plano gratuito do Supabase não inclui backups automáticos (verificado em 06/11/2026). Agendar um pg_dump diário para armazenamento externo (por exemplo, um job no GitHub Actions), com criptografia e retenção definida.

- **Restauração:** testar a restauração em staging todo trimestre; um backup que nunca foi restaurado não conta.

- **Segunda camada:** a exportação por usuário (RF-M01) também protege contra perda de dados.

## 6.8 Estrutura de pastas do repositório **NOVO**

Estrutura sugerida para o código. Cada módulo funcional (A a P) ganha uma pasta em src/features com componentes, ações, consultas, esquemas e regras puras (testáveis sem navegador).

> biblioteca/
>
> ├─ .github/workflows/ \# CI: lint, tipos, testes, E2E, Lighthouse; deploy
>
> ├─ docs/
>
> │ ├─ produto/ \# esta especificação, personas, jornadas
>
> │ ├─ adr/ \# registros de decisão (0001-...md)
>
> │ ├─ runbooks/ \# incidentes, backup e restauração, cotas
>
> │ └─ legal/ \# termos e privacidade (rascunhos)
>
> ├─ supabase/
>
> │ ├─ migrations/ \# SQL versionado (Apêndice A é a base)
>
> │ ├─ tests/ \# pgTAP: RLS e regras do banco
>
> │ ├─ functions/ \# Edge Functions (importação, limpeza de cache)
>
> │ ├─ seed.sql \# gêneros, conquistas, dados fictícios
>
> │ └─ config.toml
>
> ├─ e2e/ \# Playwright: fluxos críticos em viewport de celular
>
> ├─ public/ \# ícones PWA, manifesto, fontes locais
>
> ├─ src/
>
> │ ├─ app/ \# Next.js (App Router)
>
> │ │ ├─ (marketing)/ \# landing, termos, privacidade, ajuda
>
> │ │ ├─ (auth)/ \# entrar, criar-conta, recuperar-senha
>
> │ │ ├─ (app)/ \# área autenticada
>
> │ │ │ ├─ painel/ estantes/ livros/ adicionar/ importar/
>
> │ │ │ ├─ desejos/ leitura/ metas/ estatisticas/
>
> │ │ │ └─ listas/ series/ diario/ emprestimos/ configuracoes/
>
> │ │ ├─ s/\[token\]/ \# visualização pública, somente leitura
>
> │ │ ├─ admin/ \# curadoria (protegido por papel)
>
> │ │ └─ api/ \# route handlers: catálogo, importação, imagens
>
> │ ├─ features/ \# um diretório por módulo
>
> │ │ └─ catalog/ shelves/ wishlist/ reading/ goals/ ratings/ series/ ...
>
> │ │ ├─ components/ hooks/ actions.ts queries.ts schema.ts rules.ts
>
> │ ├─ three/ \# cena 3D isolada (carregada sob demanda)
>
> │ │ └─ scene/ shelf/ book/ spine-texture/ camera/ perf/ fallback/
>
> │ ├─ server/
>
> │ │ ├─ catalog/ \# provedores, normalização, deduplicação
>
> │ │ ├─ security/ \# rate limit, sanitização, CSV seguro
>
> │ │ └─ jobs/
>
> │ ├─ lib/ \# supabase (cliente e servidor), env, i18n, datas, isbn
>
> │ ├─ components/ \# UI compartilhada (design system)
>
> │ └─ styles/ \# tokens, tema claro e escuro
>
> ├─ tests/ \# unitários (Vitest) das regras puras
>
> ├─ .env.example \# só nomes de variáveis, nunca valores
>
> ├─ AGENTS.md \# instruções para agentes de código (Apêndice C)
>
> └─ package.json

# 7. Modelagem do banco de dados

Esta é uma das partes mais importantes do projeto: é preciso pensar na estrutura dos dados antes de desenvolver as interfaces.

## 7.1 Princípios

Uma decisão do original continua valendo: a tabela de obras não guarda se o usuário possui ou leu o livro. Ela representa a obra no catálogo geral, e a relação com cada usuário vive em outras tabelas. Isso permite que milhares de pessoas tenham o mesmo livro sem duplicar informação bibliográfica. O que esta revisão acrescenta é levar essa ideia até o fim:

- **NOVO** **Quatro camadas:** obra (works), edição (editions), exemplar do usuário (library_items) e leitura (readings). A posse mora no exemplar; o progresso, na leitura.

- **NOVO** **Catálogo global mais privado:** owner_id nulo significa catálogo global (só o servidor escreve); preenchido significa registro privado do usuário.

- **NOVO** **Toda tabela do usuário tem \[\[c:user_id\]\]** e usa chave estrangeira composta (id, user_id) nas relações, para que ninguém consiga ligar o próprio registro à estante ou à lista de outra pessoa.

- **NOVO** **Regras críticas no banco:** checks (nota em meia estrela, ISBN-13 válido, leitura concluída exige data), unicidade e funções transacionais.

- **NOVO** **Exclusão de conta em cascata:** apagar o usuário apaga seus dados, sem restos.

- **NOVO** **Nomes:** books passa a works (obra) e authors passa a people (com papel). user_books se divide em library_items e readings.

## 7.2 Modelo conceitual

<img src="media/d40659cf7f7ec79bf3b1921a85ceb53aa6e5bbf6.png" title="Diagrama do modelo conceitual com catálogo, acervo, leitura e planejamento" style="width:6.66667in;height:3.58333in" alt="Diagrama do modelo conceitual com catálogo, acervo, leitura e planejamento" />

_Figura 3. Modelo conceitual. Em verde-água, entidades novas ou redefinidas._

## 7.3 Tabelas

| **Tabela**                                     | **Responsabilidade**                                                            | **Situação**                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------- |
| **auth.users**                                 | Contas, gerenciadas pelo Supabase Auth (não é tabela própria).                  | +Alterada                    |
| **profiles**                                   | Nome, avatar, idioma, fuso, moeda e preferências.                               | Original                     |
| **works**                                      | Obras do catálogo, globais ou privadas.                                         | +Alterada (era books)        |
| **editions**                                   | Edições: ISBN, formato, páginas ou duração, dimensões, capa.                    | Original                     |
| **people**                                     | Pessoas: autores, tradutores, narradores.                                       | +Alterada (era authors)      |
| **work_contributors, edition_contributors**    | Quem participou de cada obra e edição, com o papel.                             | +Nova                        |
| **publishers**                                 | Editoras.                                                                       | +Nova                        |
| **genres, work_genres**                        | Gêneros e ligação com as obras.                                                 | Original (ligação nova)      |
| **library_items**                              | Exemplar do usuário: posse, preço, condição, estante, localização.              | +Alterada (era user_books)   |
| **shelves**                                    | Estantes: tipo, ordenação, aparência.                                           | Original                     |
| **wishlist_items**                             | Lista de desejos, com prioridade, preço-alvo e vínculo com o exemplar comprado. | +Alterada (era wishlist)     |
| **readings**                                   | Cada leitura de uma obra: estado, datas, progresso, releitura.                  | +Nova                        |
| **reading_sessions**                           | Sessões dentro de uma leitura.                                                  | Original                     |
| **reviews**                                    | Nota e resenha por obra.                                                        | Original                     |
| **custom_lists, custom_list_items**            | Rankings, listas temáticas e desafios, com posição fracionária.                 | +Alterada                    |
| **series, series_works**                       | Séries e posição de cada obra (ordem de publicação e cronológica).              | +Alterada (era series_books) |
| **reading_notes**                              | Anotações e frases favoritas.                                                   | Original                     |
| **reading_goals, goal_adjustments**            | Metas e o histórico de ajustes.                                                 | +Alterada                    |
| **achievement_definitions, user_achievements** | Conquistas e quem as desbloqueou.                                               | +Alterada (era achievements) |
| **loans**                                      | Empréstimos de exemplares.                                                      | +Nova                        |
| **import_jobs**                                | Importações e seus relatórios.                                                  | +Nova                        |
| **share_links**                                | Links públicos revogáveis.                                                      | +Nova                        |
| **external_lookup_cache**                      | Cache das consultas a APIs externas (só servidor).                              | +Nova                        |

## 7.4 Integridade e índices **NOVO**

- **ISBN-13:** um índice único para o catálogo global e outro por usuário para entradas privadas; a função is_valid_isbn13 confere o dígito verificador.

- **Chaves compostas:** estante, leitura, lista e exemplar são referenciados por (id, user_id). Apagar uma estante zera shelf_id dos exemplares sem apagá-los (recurso do PostgreSQL 15 em diante).

- **Índices:** user_id em toda tabela do usuário (necessário para a RLS ser rápida); (user_id, estado) e (user_id, data de fim) em leituras; trigram em títulos e nomes.

- **Acentos:** a função unaccent não é imutável; para indexar, criar uma função envoltória imutável.

- **Listas ordenáveis:** posição como texto fracionário, para reordenar sem reescrever a lista inteira.

- **Datas de leitura:** colunas do tipo data (sem hora) e o fuso do usuário no perfil, para que “31 de dezembro” seja o mesmo dia em qualquer servidor.

## 7.5 Políticas de RLS por grupo de tabelas **NOVO**

O original diz que usará Row Level Security. A tabela abaixo diz exatamente como. O Apêndice A traz as políticas em SQL.

| **Grupo de tabelas**                                                                                                                                                                                    | **Leitura**             | **Escrita**             | **Observação**                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| **Dados do usuário (shelves, library_items, wishlist_items, loans, readings, reading_sessions, reviews, reading_notes, reading_goals, goal_adjustments, custom_lists, custom_list_items, share_links)** | Só o dono               | Só o dono               | Quatro políticas (select, insert, update, delete) com (select auth.uid()) = user_id. |
| **Somente leitura para o usuário (user_achievements, import_jobs)**                                                                                                                                     | Dono                    | Servidor (service_role) | Impede forjar conquistas e relatórios.                                               |
| **Catálogo (works, editions, people, publishers, series)**                                                                                                                                              | Global mais os próprios | Só os próprios privados | O catálogo global é escrito pelo servidor.                                           |
| **Ligações do catálogo (work_contributors, work_genres, edition_contributors, series_works)**                                                                                                           | Herdam da tabela-pai    | Herdam da tabela-pai    | Política com exists na tabela-pai.                                                   |
| **Referência (genres, achievement_definitions)**                                                                                                                                                        | Todos os autenticados   | Servidor                | Dados estáticos.                                                                     |
| **profiles**                                                                                                                                                                                            | Dono                    | Dono (só update)        | Criado por gatilho quando a conta nasce.                                             |
| **external_lookup_cache**                                                                                                                                                                               | Ninguém                 | Servidor                | RLS ligada sem políticas e permissões revogadas.                                     |
| **Visão pública (share_links)**                                                                                                                                                                         | Pela rota do servidor   | Dono cria e revoga      | A leitura pública valida o token no servidor; nunca com política aberta.             |

## 7.6 Funções transacionais (RPC) **NOVO**

| **Função**                         | **O que faz**                                                                                     | **Segurança**                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **purchase_wishlist_item**         | Cria o exemplar e marca o desejo como comprado numa única transação (implementada no Apêndice A). | security invoker: continua sujeita à RLS do usuário.                                               |
| **start_reading, finish_reading**  | Abre e encerra uma leitura, ajustando progresso e datas.                                          | security invoker.                                                                                  |
| **export_my_data**                 | Gera o JSON completo do usuário.                                                                  | security invoker.                                                                                  |
| **merge_editions (administração)** | Mescla duplicatas movendo exemplares e leituras para a edição mantida.                            | security definer restrito ao papel de administrador, com search_path fixo e registro de auditoria. |
| **Exclusão de conta**              | Rota do servidor com a chave de serviço remove o usuário no Auth; a cascata apaga os dados.       | Só servidor.                                                                                       |

## 7.7 Migrações, seeds e testes do banco **NOVO**

- Migrações versionadas em supabase/migrations; nunca alterar tabela em produção pelo painel.

- Seeds: gêneros base, definições de conquistas e um usuário fictício; gerador de 5 mil livros para teste de desempenho.

- Testes pgTAP de RLS: para cada tabela, o usuário A não lê nem escreve dados do usuário B.

- **Validação feita nesta revisão:** o esquema do Apêndice A foi executado em um PostgreSQL 16 local, junto com um roteiro de testes que cobre isolamento entre usuários, chaves compostas, compra atômica, restrições de nota, ISBN e leitura, e exclusão em cascata. Todos passaram. As extensões pg_trgm e unaccent não existiam nesse ambiente de teste, então os índices trigram não foram exercitados.

# 8. Regras de negócio

Precisamos transformar as ideias em regras de negócio. As três primeiras subseções vêm do original; as demais foram acrescentadas para que metas, estatísticas e recomendações deem o mesmo resultado em qualquer parte do sistema.

## 8.1 Compra e transferência automática

Quando um livro da lista de desejos é marcado como comprado, o usuário escolhe o formato e o sistema o coloca na estante correspondente (física, digital ou de áudio), atualizando as estatísticas.

<img src="media/d6bb191d664d51538aa0745a40dc4065aa481cb0.png" title="Fluxo de compra: da lista de desejos até a atualização da estante e das estatísticas" style="width:4.47917in;height:3.94792in" alt="Fluxo de compra: da lista de desejos até a atualização da estante e das estatísticas" />

_Figura 4. Fluxo de compra e transferência para a estante._

- **NOVO** **Transação única:** criar o exemplar e marcar o desejo como comprado acontece na mesma função do banco; se qualquer passo falha, nada muda.

- **NOVO** **Estante sugerida pelo formato:** o usuário pode trocar para outra estante do mesmo tipo.

- **NOVO** **Aviso de duplicidade:** se a edição ou o formato já existe na biblioteca, o sistema avisa e pergunta se é outro exemplar.

- **NOVO** **Dados opcionais:** preço pago, data, loja e condição alimentam o histórico e o orçamento, mas não são obrigatórios.

- **NOVO** **Desfazer:** a compra pode ser desfeita; o exemplar é removido e o desejo volta a “desejado”.

## 8.2 Estados de posse e de leitura **NOVO**

Posse e leitura são estados independentes, cada um com seu ciclo de vida.

<img src="media/2f1703904eb57b9336c4d06cb87dd549877990b6.png" title="Máquinas de estado da posse do exemplar e da leitura" style="width:6.25in;height:4.52083in" alt="Máquinas de estado da posse do exemplar e da leitura" />

_Figura 5. Estados de posse (exemplar) e de leitura (cada leitura)._

| **Regra**              | **Descrição**                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Independência**      | Vender, doar ou perder um exemplar não apaga leituras, notas nem avaliações; elas continuam nas estatísticas.                                           |
| **Leitura ativa**      | Uma obra tem no máximo uma leitura ativa (lendo ou pausada). Várias obras podem estar ativas ao mesmo tempo, dentro do limite configurado pelo usuário. |
| **Concluir**           | Exige data de fim. A data de início é opcional, para registrar livros lidos no passado.                                                                 |
| **Abandonar**          | Conta em “abandonados”, não conta como lido. O progresso parcial só entra em páginas lidas se a meta marcar essa opção.                                 |
| **Releitura**          | Cria uma nova leitura da mesma obra. A nota é uma por obra e pode ser atualizada; o histórico de leituras é preservado.                                 |
| **Emprestado**         | Não altera o estado de leitura.                                                                                                                         |
| **Formato da leitura** | Cada leitura registra o formato principal usado (físico, e-book, audiobook).                                                                            |

## 8.3 Contabilização de livros

É preciso evitar um erro comum: contar o mesmo livro várias vezes. A plataforma deve distinguir obras únicas, exemplares físicos, edições diferentes, formatos diferentes, leituras concluídas e releituras. Por exemplo, se alguém leu uma obra em formato físico e depois em audiobook, isso representa uma obra única na biblioteca, mas duas experiências de leitura. A pessoa poderá decidir se quer contabilizar releituras na meta anual.

| **Métrica**            | **Unidade de contagem**                                  | **Regra**                                                                                  |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Obras únicas**       | Obras distintas entre os exemplares do usuário           | Uma obra conta uma vez, não importa quantas edições ou formatos.                           |
| **Exemplares**         | Linhas de exemplares                                     | Cada cópia física conta; e-book e audiobook contam como exemplares próprios.               |
| **Livros lidos**       | Leituras concluídas com data de fim no período           | Releituras só contam se a meta (ou a preferência) permitir; abandonadas não contam.        |
| **Páginas lidas**      | Soma das páginas das edições lidas (impressos e e-books) | Audiobooks não entram em páginas; abandonadas só com progresso parcial se a meta permitir. |
| **Horas ouvidas**      | Soma da duração das leituras de audiobook                | Métrica separada das páginas.                                                              |
| **Média de avaliação** | Média das notas por obra                                 | Ignora obras sem nota; uma nota por obra por usuário.                                      |
| **Livros não lidos**   | Exemplares possuídos de obras sem leitura concluída      | Uma releitura não altera esse número.                                                      |
| **Período**            | Datas no fuso do perfil                                  | A virada do ano segue o fuso do usuário, não o do servidor.                                |

## 8.4 Metas: fórmulas **NOVO**

- **Progresso (%)** = feito ÷ meta.

- **Esperado até hoje** = meta × (dias decorridos ÷ dias do período).

- **Situação:** adiantado se feito for pelo menos 105% do esperado; no ritmo se for pelo menos 95%; abaixo disso, atrasado. A tolerância de 5% é configurável.

- **Ritmo necessário** = (meta − feito) ÷ dias restantes, mostrado por semana ou por mês na interface. Meta cumprida mostra “meta cumprida”.

- Metas de páginas e de minutos usam as mesmas fórmulas. No MVP não existe meta combinada.

- Alterar a meta no meio do período recalcula o esperado e grava o ajuste no histórico.

- Se o histórico de leituras for editado, o resultado das metas é recalculado e a mudança fica registrada.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Exemplo</strong></p>
<p>Meta anual de 24 livros, 10 lidos em 30 de junho (dia 181 de 365). Esperado = 24 × 181 ÷ 365 ≈ 11,9. O piso do ritmo é 95% disso, ou 11,3; como 10 é menor, a situação é “atrasado”. Ritmo necessário = (24 − 10) ÷ (365 − 181) ≈ 0,076 livro por dia, ou cerca de 0,5 por semana. Na tela, a mensagem deve ser neutra: “um pouco abaixo do ritmo; faltam 14 livros, cerca de 1 a cada 2 semanas”.</p></td>
</tr>
</tbody>
</table>

## 8.5 Recomendações

A primeira versão não precisa de inteligência artificial generativa. O original propõe um mecanismo baseado em pontuação, que seleciona os livros da coleção e da lista de desejos e calcula quais são mais compatíveis com as preferências do usuário. Os pesos serão configuráveis posteriormente.

| **Critério**              | **Peso inicial** | **Definição operacional (nota de 0 a 1)**                                                                                                             |
| ------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gênero favorito**       | 25%              | **NOVO** Participação do gênero entre os livros concluídos com nota 4 ou mais; com pouco histórico, usa o questionário inicial.                       |
| **Avaliações anteriores** | 25%              | **NOVO** Similaridade (autor, série, gênero, tradutor ou narrador) com livros avaliados com 4 ou mais, menos penalidade para os de nota 2 ou menos.   |
| **Interesse demonstrado** | 20%              | **NOVO** Prioridade na lista de desejos, posição na fila “Próximas leituras” e série em andamento. Nunca o tempo que o livro ficou parado na estante. |
| **Histórico de leitura**  | 15%              | **NOVO** Taxa de conclusão no gênero e recência (últimos 12 meses).                                                                                   |
| **Continuação de séries** | 15%              | **NOVO** 1 se for o próximo volume de uma série cujo volume anterior foi concluído; 0 caso contrário.                                                 |

**NOVO** **Pontos fracos do original e como foram tratados:** três critérios se sobrepunham e contavam a mesma preferência mais de uma vez; “interesse demonstrado” não tinha definição; não havia o que fazer com usuário novo. Regras acrescentadas:

- **Elegibilidade:** só livros possuídos ou na lista de desejos, sem leitura ativa ou concluída; releitura apenas se o usuário pedir.

- **Diversidade:** no máximo 2 livros do mesmo autor ou série entre as 5 primeiras sugestões.

- **Explicação:** toda sugestão mostra o principal motivo, em uma frase.

- **Cold start:** com menos de 5 livros avaliados, usar o questionário e a fila manual em vez da pontuação.

- **Aleatório:** sorteio uniforme entre os elegíveis, respeitando os filtros.

- **“O que ler agora?”:** filtros de tempo disponível (páginas ou horas), formato e continuação de série.

- **Como medir:** taxa de sugestões aceitas (“vou ler”) e de livros iniciados em até 14 dias.

## 8.6 Duplicidade e identidade de livros **NOVO**

- **Identidade principal:** ISBN-13 normalizado. Um ISBN-10 vira ISBN-13 com o prefixo 978, os 9 primeiros dígitos e um novo dígito verificador.

- **Sem ISBN:** impressão digital = título normalizado (minúsculas, sem acentos nem pontuação) mais primeiro autor normalizado mais idioma.

- **Três resultados possíveis:** igual (mesmo ISBN, reutilizar), provável (mesma impressão digital ou títulos muito parecidos; perguntar “é o mesmo livro?”) ou diferente (cadastrar).

- **Mesma obra, outra edição ou formato:** cria uma nova edição ligada à mesma obra.

- **Dois exemplares do mesmo livro:** permitido, com aviso.

- **Mesclagem:** exemplares e leituras migram para a edição mantida; a descartada vira redirecionamento. Usuários mesclam suas entradas privadas; o catálogo global é mesclado pela curadoria.

- **Importações:** cada linha segue as mesmas regras; reimportar o mesmo arquivo não cria duplicatas.

## 8.7 Capas e lombadas **NOVO**

| **Item**               | **Regra (valores são estimativas iniciais, ajustáveis)**                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Capa**               | Baixada na criação da edição, convertida para formato moderno (WebP) em 256 e 512 px e guardada no Storage; nunca carregada direto da fonte pelo 3D.                                     |
| **Cor predominante**   | Extraída na ingestão e guardada na edição; alimenta a lombada e a ordenação por cor.                                                                                                     |
| **Espessura**          | Cerca de 2 mm mais 0,05 mm por página, mínimo de 6 mm; sem número de páginas, 20 mm.                                                                                                     |
| **Altura**             | Dimensão da edição, se existir; senão por formato: bolso 18 cm, brochura 21 cm, capa dura 23 cm. E-books e audiobooks usam altura padronizada e espessura fina, com marcador do formato. |
| **Lombada procedural** | Cor da capa com título e autor; o texto é claro ou escuro conforme o contraste calculado (mínimo de 4,5:1).                                                                              |
| **Reserva**            | Sem capa: capa tipográfica com cor derivada de um hash do título.                                                                                                                        |
| **Direitos**           | Guardar só miniaturas, respeitar os termos de cada fonte, preferir o envio pelo usuário e remover a capa a pedido.                                                                       |

## 8.8 Privacidade, retenção e exclusão **NOVO**

- **Padrões:** tudo privado; imagens e links públicos só por ação explícita; imagens sem preço nem nota por padrão.

- **Exclusão de conta:** remove perfil, acervo, leituras, notas e arquivos do Storage; entradas privadas do catálogo saem junto. Os backups expiram na janela de retenção, que deve constar na política de privacidade (sugestão: 30 dias).

- **Retenção:** logs de erro por 30 a 90 dias, sem dados pessoais; cache externo conforme o TTL; arquivos de importação apagados poucos dias depois do processamento (sugestão: 7).

- **Exportação:** sempre disponível, em JSON e CSV.

- **Menores de idade:** ver seção 11.4.

# 9. Identidade visual e experiência tridimensional

A identidade visual é um elemento central do produto. A direção do original é o **Modern Literary 3D**: uma combinação de biblioteca clássica, design editorial contemporâneo e interface digital minimalista. Não se recomenda uma biblioteca 3D extremamente detalhada na primeira versão: começar com estantes modulares, lombadas e capas simplificadas, e depois acrescentar iluminação, decoração, câmeras e personalização avançada.

## 9.1 Diretrizes e referências

| **Referência**                | **Uso**                                   |
| ----------------------------- | ----------------------------------------- |
| **Madeira e biblioteca**      | Referência para a estante física.         |
| **Design editorial**          | Referência para o painel e o catálogo.    |
| **Interface digital**         | Referência para navegação e estatísticas. |
| **Biblioteca tridimensional** | Referência para a experiência interativa. |

- Tipografia serifada para títulos e elementos editoriais; sem serifa para menus e informações técnicas.

- Paleta principal em tons de creme, madeira, marrom e grafite; possibilidade de tema escuro.

- Capas dos livros como elementos visuais de destaque.

- Animações discretas ao adicionar e movimentar livros; transições entre as três estantes.

## 9.2 Tokens de design e contraste **NOVO**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Paleta em revisão</strong></p>
<p>A identidade escolhida é a Bordô Editorial. Os valores da tabela abaixo são da proposta inicial (creme, marrom e verde-água) e servem de método: para cada par de cores, calcular o contraste. Os tokens finais do Bordô Editorial, claro e escuro, devem substituir esta tabela.</p></td>
</tr>
</tbody>
</table>

Uma proposta de partida para a paleta, com a razão de contraste de cada par calculada pela fórmula do WCAG. A meta é 4,5:1 para texto e 3:1 para componentes de interface.

| **Tema** | **Par (frente sobre fundo)**     | **Cores**               | **Contraste** | **Uso**                                                        |
| -------- | -------------------------------- | ----------------------- | ------------- | -------------------------------------------------------------- |
| Claro    | Texto principal sobre fundo      | \#2B2B2E sobre \#F7F2E9 | 12,66         | Corpo do texto                                                 |
| Claro    | Texto secundário sobre fundo     | \#5C5348 sobre \#F7F2E9 | 6,76          | Legendas, apoio                                                |
| Claro    | Títulos (marrom) sobre fundo     | \#4A2F1B sobre \#F7F2E9 | 10,99         | Títulos                                                        |
| Claro    | Ação (verde-água) sobre fundo    | \#0F6B5A sobre \#F7F2E9 | 5,76          | Links e destaques                                              |
| Claro    | Texto branco sobre botão         | \#FFFFFF sobre \#0F6B5A | 6,42          | Botão primário                                                 |
| Claro    | Madeira sobre fundo              | \#8B5E3C sobre \#F7F2E9 | 5,00          | Acentos                                                        |
| Claro    | Erro sobre fundo                 | \#A63A1F sobre \#F7F2E9 | 5,80          | Mensagens de erro                                              |
| Claro    | **Latão sobre fundo**            | \#B08D57 sobre \#F7F2E9 | **2,77**      | **Somente decoração.** Reprova para texto e bordas essenciais. |
| Escuro   | Texto principal sobre fundo      | \#EFE8DC sobre \#1E1B18 | 14,08         | Corpo do texto                                                 |
| Escuro   | Texto secundário sobre fundo     | \#BDB2A2 sobre \#1E1B18 | 8,21          | Legendas                                                       |
| Escuro   | Ação sobre fundo                 | \#5CC4AE sobre \#1E1B18 | 8,13          | Links e destaques                                              |
| Escuro   | Latão claro sobre fundo          | \#D4B27A sobre \#1E1B18 | 8,53          | Acento                                                         |
| Escuro   | Texto principal sobre superfície | \#EFE8DC sobre \#2A2621 | 12,34         | Cartões                                                        |
| Escuro   | Erro claro sobre fundo           | \#F08A6C sobre \#1E1B18 | 6,98          | Mensagens de erro                                              |

- **Tipografia:** títulos com fonte serifada (por exemplo Fraunces ou Source Serif 4) e interface sem serifa (por exemplo Inter), ambas de licença aberta. Servir as fontes pelo próprio site (next/font), sem depender de terceiros nem enviar dados do usuário a servidores externos.

- **Escala e espaçamento:** tamanhos 12, 14, 16, 20, 24 e 32; base de espaçamento de 4 px; raio de 8 px.

- **Movimento:** transições de 150 a 250 ms; nada em loop só para decorar; respeitar prefers-reduced-motion.

- **Componentes base:** botão, campo, cartão de livro, etiqueta de estado, barra de progresso, estante (lista, grade e 3D), gaveta ou modal, aviso com “desfazer”, estado vazio e skeleton.

## 9.3 Especificação do motor 3D **NOVO**

Os valores de orçamento são alvos para guiar o spike da Fase 0 e devem ser medidos em aparelhos reais.

| **Tema**              | **Especificação**                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cena**              | Unidade de estante modular (largura e número de prateleiras fixos); várias unidades lado a lado e em fileiras para acervos grandes; o layout vem da ordenação escolhida.                                  |
| **Livro**             | Caixa com três materiais (capa, lombada, páginas); medidas pela seção 8.7; pequena variação de altura e inclinação para parecer real, determinística por id (a estante não muda a cada carga).            |
| **Texturas**          | Capa em 256 px na visão geral e 512 px ao focar; lombada procedural gerada em canvas fora da thread principal e guardada em cache; atlas de texturas para reduzir chamadas de desenho.                    |
| **Desempenho**        | Livros sem textura individual em InstancedMesh; níveis de detalhe (longe, caixa colorida; perto, textura); renderizar só a prateleira visível e as vizinhas; frameloop="demand" e pausa com a aba oculta. |
| **Orçamento (alvos)** | Até 150 chamadas de desenho; até 64 MB de texturas na GPU em celular; primeira cena interativa em até 4 s em 4G; chunk do 3D até 600 KB gzip.                                                             |
| **Câmera e gestos**   | Órbita com ângulos limitados e encaixe por prateleira; voo suave até o livro buscado. Arrastar gira, pinça dá zoom, toque seleciona, toque longo move.                                                    |
| **Interação**         | Toque ou hover puxa o livro; toque duplo abre o detalhe em painel 2D sobreposto; mover entre prateleiras arrastando, sempre com um menu como alternativa.                                                 |
| **Iluminação**        | Luz hemisférica mais uma direcional; sem sombras dinâmicas no celular (oclusão ambiente pré-calculada).                                                                                                   |
| **Por formato**       | Físico com espessura estimada; e-book como livro fino padronizado com marcador de dispositivo; audiobook com marcador de fone.                                                                            |
| **Erros**             | Tratar perda de contexto WebGL mostrando o 2D e oferecendo recarregar; nunca tela em branco.                                                                                                              |
| **CORS**              | Texturas só de domínio próprio (Storage), para o navegador não bloquear imagens de outras origens.                                                                                                        |

## 9.4 Níveis de capacidade do aparelho **NOVO**

| **Nível** | **Condição**                                                                               | **Experiência**                                                                 |
| --------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **0**     | Sem WebGL2, preferência “3D desligado” ou necessidade declarada de movimento reduzido      | Lista e grade 2D completas.                                                     |
| **1**     | WebGL disponível, aparelho fraco (pouca memória ou taxa de quadros baixa no teste inicial) | 3D simplificado: sem animações de entrada, texturas pequenas, estantes menores. |
| **2**     | Aparelho capaz                                                                             | 3D completo.                                                                    |

A detecção combina a capacidade do navegador (WebGL2), memória e núcleos quando o navegador informa (os valores são aproximados e nem todo navegador os expõe) e um teste curto de taxa de quadros na primeira abertura. O resultado vira preferência salva, e a troca manual 2D ou 3D fica sempre visível.

## 9.5 Acessibilidade e testes do 3D **NOVO**

- O canvas 3D é tratado como decorativo para tecnologias assistivas; a alternativa é a lista sincronizada, em HTML real. Selecionar na lista destaca no 3D e vice-versa.

- Teclado: setas movem entre livros, Enter abre, Esc fecha; os atalhos ficam listados na tela.

- Movimento reduzido: sem animações de voo; transições instantâneas.

- Informação essencial (título, estado, progresso) sempre fora do canvas.

- Testes: teste de fumaça com Playwright (a cena renderiza e responde), medição de quadros em aparelho real e teste da alternativa com leitor de tela.

# 10. Telas, navegação e fluxos **NOVO**

O original manda começar pelos wireframes. Para isso é preciso saber quais telas existem. Esta seção lista as rotas, o que cada tela precisa mostrar e quais estados desenhar.

## 10.1 Rotas e inventário de telas

| **Rota**                                    | **Tela**                      | **Conteúdo principal**                                                              | **Estados a desenhar**                                            | **Release**      |
| ------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------- |
| **/**                                       | Landing                       | Proposta de valor, demonstração, chamada para criar conta                           | Carregando, erro                                                  | R0               |
| **/entrar, /criar-conta, /recuperar-senha** | Autenticação                  | Formulários, login social, mensagens claras                                         | Credencial inválida, e-mail não verificado, excesso de tentativas | R0               |
| **/termos, /privacidade, /ajuda**           | Institucionais                | Termos, política em linguagem simples, ajuda                                        | Não se aplica                                                     | R0               |
| **/s/\[token\]**                            | Visão pública                 | Estante ou ranking somente leitura                                                  | Link expirado ou revogado                                         | R1.x             |
| **/painel**                                 | Painel inicial                | Lendo agora, metas, próximas leituras, atividade                                    | Vazio, carregando                                                 | R0               |
| **/estantes**                               | Estantes                      | Três estantes, alternância 2D e 3D, busca e filtros                                 | Vazio, erro de 3D, modo leve                                      | R0 (2D), R1 (3D) |
| **/livros/\[id\]**                          | Detalhe do livro              | Abas: informações, edições, meu exemplar, leitura, notas                            | Sem capa, sem metadados, editando                                 | R0               |
| **/adicionar**                              | Adicionar livro               | Busca, ISBN, câmera e manual, com aviso de duplicidade                              | Sem resultado, API fora, câmera negada                            | R0               |
| **/importar**                               | Importação                    | Envio, mapeamento, pré-visualização, relatório, desfazer                            | Arquivo inválido, importação parcial                              | R0               |
| **/desejos**                                | Lista de desejos              | Prioridade, preço, orçamento, botão comprar                                         | Vazio, orçamento estourado                                        | R0               |
| **/leitura**                                | Leitura                       | Lendo agora, atualizar progresso, concluir, abandonar                               | Sem leitura ativa                                                 | R0               |
| **/metas**                                  | Metas                         | Metas, ritmo, situação, histórico                                                   | Sem meta, meta cumprida                                           | R0               |
| **/estatisticas**                           | Estatísticas                  | Gráficos por período, formato e gênero                                              | Poucos dados                                                      | R0               |
| **/listas, /listas/\[id\]**                 | Rankings e listas             | Ordem manual, desafios                                                              | Vazio                                                             | R1.x             |
| **/series, /series/\[id\]**                 | Séries                        | Volumes, ausentes, progresso                                                        | Série sem total                                                   | R1.x             |
| **/diario**                                 | Diário                        | Notas e frases, busca                                                               | Vazio                                                             | R1.x             |
| **/emprestimos**                            | Empréstimos                   | Emprestados e pegos, prazos                                                         | Sem empréstimos                                                   | R1.x             |
| **/configuracoes/\***                       | Configurações                 | Conta, privacidade, aparência (tema e 3D), dados (exportar e excluir), notificações | Confirmação de exclusão                                           | R0               |
| **/admin/\***                               | Curadoria                     | Mesclar, corrigir, sugestões, uso e custos                                          | Sem permissão                                                     | R1.x             |
| **Transversais**                            | 404, 500, offline, manutenção | Mensagem clara com caminho de volta                                                 | Não se aplica                                                     | R0               |

## 10.2 Fluxos críticos

| **Fluxo**                             | **Passos**                                                                                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Primeiro uso**                   | Criar conta (e-mail ou Google) e verificar o e-mail → onboarding em 3 passos → adicionar o primeiro livro (escanear ou buscar) → ver o livro na estante → convite para importar o acervo.             |
| **2. Adicionar por câmera**           | Abrir Adicionar e permitir a câmera → apontar para o código → conferir a edição encontrada (capa, título, editora) → escolher formato e estante → salvar → “desfazer” disponível por alguns segundos. |
| **3. Comprar da lista de desejos**    | Tocar em “comprei” → aviso se já possui → informar formato, preço, data e loja → confirmar → o livro aparece na estante certa e o desejo sai da lista.                                                |
| **4. Registrar progresso e concluir** | Abrir Leitura → atualizar página, porcentagem ou tempo → ao terminar, marcar concluído com a data → avaliar com meia estrela → ver a meta avançar.                                                    |
| **5. Criar e acompanhar uma meta**    | Escolher tipo (livros, páginas ou minutos) e período → definir o alvo → ver situação e ritmo necessário no painel → ajustar se preciso.                                                               |
| **6. Exportar e excluir a conta**     | Configurações, Dados → exportar JSON ou CSV → excluir conta com confirmação forte → mensagem final com o prazo de apagamento dos backups.                                                             |

## 10.3 Princípios de UX

- Mobile-first: ações principais ao alcance do polegar.

- Desfazer em vez de confirmar; confirmação forte só para o que é destrutivo e irreversível (excluir conta).

- Estados vazios que ensinam o próximo passo.

- Skeletons no lugar de spinners; nada que pule de lugar ao carregar.

- Linguagem neutra em metas: informar, nunca culpar.

- Formulários curtos, com valores padrão inteligentes (formato e estante sugeridos, data de hoje).

- Foco visível e ordem de tabulação lógica; o “modo leve” sempre acessível.

## 10.4 Wireframes: o que desenhar primeiro

1.  Painel inicial.

2.  Estantes, em 2D e em 3D.

3.  Adicionar livro (busca, ISBN e câmera).

4.  Detalhe do livro.

5.  Lista de desejos, com a ação de comprar.

6.  Metas.

Critérios de sucesso do teste com 5 pessoas e um protótipo clicável: adicionar um livro por ISBN em até 30 s; achar um livro na estante em até 10 s; entender a situação da meta sem explicação.

# 11. Segurança, privacidade e conformidade **NOVO**

O original coloca segurança e privacidade como requisitos não funcionais e cita a RLS. Esta seção transforma isso em regras, ameaças, controles e obrigações legais com dono e prazo.

## 11.1 Regras de ouro

- Chaves privilegiadas (chave de serviço do Supabase e chaves de APIs de terceiros) ficam só no servidor: nunca no cliente, nunca no repositório.

- Acesso a dados por consultas parametrizadas ou ORM; nunca concatenar texto em SQL.

- Toda entrada é validada no servidor (Zod), independente da validação do navegador.

- RLS ligada em todas as tabelas, com teste automatizado.

- Privado por padrão; coleta mínima de dados pessoais.

## 11.2 Modelo de ameaças

| **Ameaça**                                  | **Exemplo**                                                      | **Mitigação**                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Acesso a dados de outro usuário**         | Trocar um id na URL ou na API                                    | RLS em todas as tabelas; chaves compostas; testes de RLS; nunca confiar em user_id vindo do cliente.                                |
| **Vazamento de chave de serviço**           | Chave no código do navegador ou no Git                           | Chaves só no servidor; variáveis por ambiente; varredura de segredos no CI; rotação.                                                |
| **Abuso de APIs e de custo**                | Bots criando contas; consultas em massa por ISBN                 | CAPTCHA, rate limit, cotas por usuário, alertas de custo, chave de desligamento.                                                    |
| **Injeção de script (XSS)**                 | Título importado ou nota com HTML e script                       | Renderização pelo React (escapa por padrão), Markdown sanitizado, CSP restritiva, nunca injetar HTML de usuário.                    |
| **Injeção de SQL**                          | Busca com aspas e comandos                                       | Consultas parametrizadas ou ORM; nenhuma concatenação.                                                                              |
| **Upload malicioso**                        | Arquivo disfarçado de imagem; SVG com script                     | Aceitar só PNG, JPEG e WebP; validar o tipo real e o tamanho; reprocessar a imagem; remover metadados; não aceitar SVG de usuários. |
| **Requisição forjada pelo servidor (SSRF)** | Servidor baixando capa de uma URL arbitrária                     | Baixar só de domínios permitidos; bloquear endereços internos; limitar tamanho e tempo.                                             |
| **Injeção em planilha**                     | Título começando com =, +, - ou @ ao exportar CSV                | Neutralizar a célula (prefixo de apóstrofo) ao exportar.                                                                            |
| **Tomada de conta**                         | Força bruta; senha vazada reaproveitada                          | Rate limit no login; verificação de e-mail; mensagens que não revelam se o e-mail existe; 2FA opcional (R2).                        |
| **Cadeia de suprimentos**                   | Pacote malicioso ou inexistente sugerido por um assistente de IA | Lockfile; Dependabot; conferir se o pacote existe e é mantido antes de instalar; revisar dependências novas.                        |
| **Adivinhação de links públicos**           | Tentar tokens de compartilhamento                                | Token de 128 bits ou mais, sem relação com ids; limite de tentativas; revogação.                                                    |
| **Vazamento em imagens compartilhadas**     | Preço, nota ou dado pessoal visível                              | Padrão sem esses dados; remover metadados; pré-visualização antes de compartilhar.                                                  |
| **Perda de dados**                          | Erro de migração; exclusão acidental                             | Backup externo; restauração testada; migrações reversíveis.                                                                         |

## 11.3 Padrões de RLS e armadilhas

- Ligar a RLS em toda tabela do schema público; sem política, ninguém acessa (exceto a chave de serviço).

- Escrever (select auth.uid()) nas políticas: o Postgres avalia uma vez por consulta, o que melhora o desempenho; indexar as colunas usadas.

- Nunca usar user_metadata para autorização, porque o próprio usuário consegue alterá-lo. Papéis ficam em app_metadata (só o servidor altera) ou em tabela própria.

- Views ignoram a RLS por padrão (rodam como o dono); criar com security_invoker = true.

- Funções security definer: definir search_path vazio, qualificar os nomes e revogar a execução de quem não precisa.

- Storage: políticas por pasta, com o id do usuário no caminho do arquivo.

- Testar como o papel authenticated, nunca como administrador (administrador ignora a RLS).

- Conexão direta com o Postgres, como em um ORM, usa papel privilegiado e ignora a RLS: nesse caminho a autorização tem de estar no código.

## 11.4 LGPD, ECA Digital e outras obrigações

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Não é aconselhamento jurídico</strong></p>
<p>Esta tabela organiza as perguntas que precisam de resposta jurídica. Antes do lançamento, validar com advogado ou encarregado de proteção de dados.</p></td>
</tr>
</tbody>
</table>

| **Tema**                                     | **O que fazer no produto**                                                                                                                                                                                                                                                                                                                                                            | **Referência**                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Transparência**                            | Política de Privacidade em linguagem simples (quais dados, para quê, por quanto tempo, com quem se compartilha) e Termos de Uso, com aceite versionado.                                                                                                                                                                                                                               | LGPD (Lei 13.709/2018)             |
| **Base legal**                               | Execução do contrato para conta e acervo; consentimento para o que for opcional (e-mails, analytics com cookies).                                                                                                                                                                                                                                                                     | LGPD, art. 7                       |
| **Direitos do titular**                      | Acesso, correção, portabilidade e eliminação já cobertos por perfil, exportação e exclusão de conta; criar um canal de contato para pedidos.                                                                                                                                                                                                                                          | LGPD, art. 18                      |
| **Encarregado**                              | Definir quem responde pela proteção de dados e publicar o contato.                                                                                                                                                                                                                                                                                                                    | LGPD, art. 41                      |
| **Registro das operações**                   | Manter um inventário simples dos dados tratados e dos operadores.                                                                                                                                                                                                                                                                                                                     | LGPD, art. 37                      |
| **Operadores e transferência internacional** | Listar Supabase, hospedagem, monitoramento, analytics e e-mail; conferir onde os dados ficam e as garantias contratuais; preferir a região de São Paulo.                                                                                                                                                                                                                              | LGPD, arts. 33 a 36                |
| **Incidentes**                               | Plano de resposta; comunicar a ANPD e os titulares quando houver risco ou dano relevante.                                                                                                                                                                                                                                                                                             | LGPD, art. 48                      |
| **Crianças e adolescentes**                  | Tratar dados no melhor interesse do menor. O ECA Digital está em vigor desde 17/03/2026 e vale para serviços de tecnologia direcionados a menores ou de acesso provável por eles; a ANPD fiscaliza. Um app de leitura pode ser de acesso provável por adolescentes. Decidir idade mínima, verificação de idade proporcional, configurações protetivas por padrão e canal de denúncia. | LGPD, art. 14; Lei 15.211/2025     |
| **Cookies e analytics**                      | Preferir analytics sem cookies e sem dados pessoais; cookie não essencial exige consentimento.                                                                                                                                                                                                                                                                                        | LGPD                               |
| **Pequeno porte**                            | Verificar se o enquadramento como agente de tratamento de pequeno porte simplifica obrigações.                                                                                                                                                                                                                                                                                        | Regulamentação da ANPD (verificar) |

## 11.5 Termos de uso e conteúdo de terceiros

- O conteúdo do usuário é privado e usado só para operar o serviço, com licença limitada a isso.

- Regras de uso aceitável, encerramento de conta e limites de uso (cotas) descritos nos termos.

- Metadados e capas de terceiros: dar atribuição e respeitar os termos de cada fonte; manter um canal para pedido de remoção.

## 11.6 Resposta a incidentes

1.  Detectar e conter: desligar o recurso afetado (chave de desligamento) e revogar sessões e chaves, se preciso.

2.  Avaliar o alcance: quais dados, quantos usuários, desde quando.

3.  Corrigir e rotacionar chaves e senhas envolvidas.

4.  Comunicar titulares e ANPD quando houver risco ou dano relevante.

5.  Registrar a linha do tempo e as decisões.

6.  Revisão pós-incidente: ajustar controles, testes e este documento.

# 12. Qualidade, testes e entrega **NOVO**

## 12.1 Estratégia de testes

| **Camada**         | **Ferramenta**                                            | **O que cobre**                                                              | **Meta**                                           |
| ------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| **Unitários**      | Vitest                                                    | Regras puras: ISBN, duplicidade, contagem, metas, fuso horário               | Cobertura alta nas regras de negócio (alvo de 90%) |
| **Banco**          | pgTAP ou scripts SQL                                      | RLS, restrições e funções                                                    | Toda tabela com teste de isolamento                |
| **Componentes**    | Testing Library                                           | Formulários, estados vazios, acessibilidade básica                           | Componentes críticos                               |
| **Integração**     | Vitest com Supabase local                                 | Ações do servidor, importação, pipeline de catálogo com provedores simulados | Fluxos de dados críticos                           |
| **E2E**            | Playwright                                                | Fluxos 1 a 6 da seção 10.2, em viewport de celular                           | Fluxos críticos verdes no CI                       |
| **Acessibilidade** | axe-core e revisão manual                                 | WCAG 2.2 AA                                                                  | Nenhuma violação grave                             |
| **Desempenho**     | Lighthouse CI e perfil do 3D                              | Web Vitals, orçamento de JS, quadros por segundo                             | Dentro dos orçamentos da seção 5                   |
| **Segurança**      | Varredura de segredos, auditoria de dependências, revisão | Seção 11                                                                     | Nenhum achado crítico                              |

## 12.2 Casos de teste que não podem faltar

- **ISBN:** válido, inválido, ISBN-10 convertido, com hífens.

- **Duplicidade:** mesmo ISBN, mesma impressão digital, outra edição, outro formato, dois exemplares.

- **Compra atômica:** falha no meio não deixa estado parcial; compra repetida é recusada.

- **Metas e fuso:** 31 de dezembro às 23:30 em Brasília já é 1º de janeiro em UTC; o livro deve contar no ano certo. Também releituras, abandonados e mudança de meta.

- **Estatísticas:** uma obra lida em dois formatos conta uma obra e duas leituras.

- **Importação:** arquivo repetido não duplica; linha inválida vai para o relatório; o rollback desfaz tudo.

- **Exportação CSV:** células iniciadas por =, +, - ou @ são neutralizadas.

- **RLS:** o usuário A nunca lê nem escreve dados do usuário B em nenhuma tabela.

- **3D:** sem WebGL cai para 2D; perda de contexto não deixa tela em branco.

## 12.3 Pipeline de integração contínua

1.  Lint e formatação.

2.  Verificação de tipos (TypeScript estrito).

3.  Testes unitários e de componentes.

4.  Migrações aplicadas em banco limpo, seguidas dos testes de RLS.

5.  Build.

6.  E2E de fumaça (fluxos 1 a 3).

7.  Lighthouse CI com orçamentos de desempenho.

8.  axe-core.

9.  Varredura de segredos e auditoria de dependências.

10. Deploy de prévia. O merge só acontece com tudo verde.

## 12.4 Preparado e pronto

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Definição de preparado (antes de começar)</strong></th>
<th><strong>Definição de pronto (para fechar)</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p>Objetivo claro e critérios de aceite escritos.</p>
<p>Telas desenhadas, quando houver interface.</p>
<p>Dependências conhecidas.</p>
<p>Impacto em dados e segurança avaliado.</p></td>
<td><p>Critérios de aceite atendidos.</p>
<p>Testes passando (unitários, banco e E2E quando couber).</p>
<p>Navegável por teclado; nenhuma violação grave no axe.</p>
<p>RLS testada se tocar dados.</p>
<p>Documentação e ADR atualizados; evento de métrica definido.</p>
<p>Revisão de código feita.</p></td>
</tr>
</tbody>
</table>

## 12.5 Beta fechado

- 20 a 30 convidados, com perfis parecidos com as personas, por convite ou lista de espera (também limita custos).

- Feedback dentro do app (botão) e entrevistas curtas.

- Métricas acompanhadas: ativação, retenção em 7 e 30 dias, resolução de ISBN, erros, custo por usuário ativo.

- Para sair do beta: nenhum erro crítico por 2 semanas, retenção em 30 dias dentro da meta (ou explicação clara do desvio), custo por usuário ativo conhecido e o checklist de lançamento (Apêndice D) concluído.

# 13. Roadmap de desenvolvimento

O original propõe seis fases. Elas foram mantidas, com duas mudanças: uma Fase 0 de descoberta antes de tudo e a redistribuição do escopo conforme os releases (R0, R1, R1.x). Cada fase agora tem critério de saída. Os itens marcados como **NOVO** foram acrescentados.

<table>
<colgroup>
<col style="width: 19%" />
<col style="width: 44%" />
<col style="width: 20%" />
<col style="width: 14%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Fase</strong></th>
<th><strong>Entregas</strong></th>
<th><strong>Critério de saída</strong></th>
<th><strong>Estimativa</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Fase 0. Descoberta e validação</strong></td>
<td>Entrevistas com 8 a 10 leitores; uso comparativo de Goodreads, StoryGraph e Skoob; spike do catálogo (200 ISBNs, cobertura por fonte); spike do 3D (500 livros em celular intermediário); decisões sobre hospedagem e idade mínima.</td>
<td>Relatório de go ou no-go (M0).</td>
<td>2 semanas</td>
</tr>
<tr class="even">
<td><strong>Fase 1. Fundação do projeto</strong></td>
<td><p>Definir nome e identidade visual; criar a documentação funcional; definir a estrutura do banco; construir protótipos das telas; definir a arquitetura técnica.</p>
<p><strong>NOVO</strong> Repositório, ambientes e CI mínimo; ADRs das decisões D-01 a D-11; wireframes das 6 telas prioritárias.</p></td>
<td>Wireframes aprovados e esquema do banco revisado (M1).</td>
<td>2 a 3 semanas</td>
</tr>
<tr class="odd">
<td><strong>Fase 2. Sistema de biblioteca (R0)</strong></td>
<td><p>Cadastro e login; catálogo; as três estantes (em 2D); lista de desejos; status dos livros.</p>
<p><strong>NOVO</strong> Leitura e progresso; metas e estatísticas essenciais; notas; onboarding e importação; exportação e exclusão de conta; testes de RLS.</p></td>
<td>R0 usado pelo dono por 2 semanas, sem planilha paralela (M2).</td>
<td>6 a 8 semanas</td>
</tr>
<tr class="even">
<td><strong>Fase 3. Experiência 3D (R1)</strong></td>
<td><p>Estantes tridimensionais; capas e lombadas; movimentação dos livros; personalização visual.</p>
<p><strong>NOVO</strong> Lombadas procedurais; níveis de capacidade; alternativa acessível; feature flags; orçamento de desempenho.</p></td>
<td>Metas de desempenho atingidas em 3 aparelhos; teste de teclado e de leitor de tela (M3).</td>
<td>4 a 6 semanas</td>
</tr>
<tr class="odd">
<td><strong>Fase 4. Inteligência literária (R1.x)</strong></td>
<td><p>Rankings; identificação de sagas; recomendações. Metas e estatísticas básicas já saíram na Fase 2.</p>
<p><strong>NOVO</strong> Listas e desafios; “o que ler agora”; retrospectiva anual; compartilhamento; empréstimos; diário. Pode sair em incrementos.</p></td>
<td>Cada módulo com seus critérios de aceite.</td>
<td>5 a 7 semanas</td>
</tr>
<tr class="even">
<td><strong>Fase 5. Testes e otimização</strong></td>
<td><p>Testes em dispositivos móveis; testes de desempenho 3D; segurança dos dados; correção de erros; testes com usuários.</p>
<p><strong>NOVO</strong> Beta fechado; auditoria de acessibilidade; teste de restauração de backup; revisão jurídica da política.</p></td>
<td>Critérios de saída do beta (M4).</td>
<td>3 a 4 semanas</td>
</tr>
<tr class="odd">
<td><strong>Fase 6. Lançamento</strong></td>
<td><p>Publicação do site; cadastro de usuários; documentação de utilização; monitoramento de desempenho.</p>
<p><strong>NOVO</strong> Checklist de lançamento (Apêndice D); plano de custos ativo; canal de suporte.</p></td>
<td>Lançamento público (M5).</td>
<td>1 a 2 semanas</td>
</tr>
</tbody>
</table>

<img src="media/d351e34af8d3c6df14fb1fc25a4edc50ca6ffc8b.png" title="Linha do tempo das fases 0 a 6 com marcos M0 a M5" style="width:6.45833in;height:3.05208in" alt="Linha do tempo das fases 0 a 6 com marcos M0 a M5" />

_Figura 6. Linha do tempo estimada (cronograma sequencial, uma pessoa)._

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Sobre as estimativas</strong></p>
<p>São estimativas de planejamento para uma pessoa em dedicação parcial (cerca de 15 horas por semana) com apoio de IA para escrever código. A soma varia de 23 a 32 semanas. A confiança é baixa até a Fase 1; recalibrar nesse ponto com a velocidade real.</p></td>
</tr>
</tbody>
</table>

## Marcos e dependências críticas **NOVO**

| **Marco** | **Significado**                                    |
| --------- | -------------------------------------------------- |
| **M0**    | Go ou no-go depois dos spikes de catálogo e de 3D. |
| **M1**    | Wireframes e esquema do banco aprovados.           |
| **M2**    | R0 em uso pelo dono do projeto.                    |
| **M3**    | 3D validado em aparelhos reais.                    |
| **M4**    | Beta fechado concluído.                            |
| **M5**    | Lançamento público.                                |

- Hospedagem e plano de custos decididos antes de qualquer divulgação pública (seção 16).

- Revisão jurídica da política de privacidade e da idade mínima antes do beta.

- Spike de catálogo antes de fechar a ordem dos provedores.

- Wireframes aprovados antes de programar o 3D (decisão do original).

# 14. Backlog inicial e critérios de aceite **NOVO**

Backlog do R0, para a Fase 2. Tamanhos para uma pessoa: **P** até 1 dia, **M** de 2 a 4 dias, **G** de uma semana ou mais.

## 14.1 Histórias do R0

| **ID**  | **Épico**      | **História**                                                                                                          | **Tam.** | **Depende de** |
| ------- | -------------- | --------------------------------------------------------------------------------------------------------------------- | -------- | -------------- |
| **B01** | Fundação       | Como desenvolvedor, quero repositório, ambientes (local, staging, produção) e CI mínimo, para entregar com segurança. | M        | nenhum         |
| **B02** | Fundação       | Como desenvolvedor, quero o esquema do Apêndice A como migração versionada, com seeds e testes de RLS no CI.          | M        | B01            |
| **B03** | Conta          | Como usuário, quero criar conta e entrar por e-mail ou Google, com verificação de e-mail e recuperação de senha.      | M        | B02            |
| **B04** | Conta          | Como usuário, quero um perfil com idioma, fuso e moeda e aceitar os termos com registro de versão.                    | P        | B03            |
| **B05** | Conta          | Como usuário, quero exportar meus dados e excluir minha conta.                                                        | M        | B03, B10       |
| **B06** | Catálogo       | Como usuário, quero buscar no meu acervo por título ou autor, com tolerância a acentos.                               | M        | B10            |
| **B07** | Catálogo       | Como usuário, quero adicionar um livro por ISBN digitado e ver capa e dados preenchidos.                              | G        | B02            |
| **B08** | Catálogo       | Como usuário, quero escanear o código de barras com a câmera.                                                         | M        | B07            |
| **B09** | Catálogo       | Como usuário, quero cadastrar manualmente um livro sem ISBN, com aviso de possível duplicidade.                       | M        | B02            |
| **B10** | Estantes       | Como usuário, quero as estantes física, digital e de áudio, com meus livros em lista e grade.                         | M        | B07            |
| **B11** | Estantes       | Como usuário, quero ordenar e filtrar a estante.                                                                      | P        | B10            |
| **B12** | Leitura        | Como usuário, quero marcar um livro como lendo, pausado, concluído ou abandonado, com datas.                          | M        | B10            |
| **B13** | Leitura        | Como usuário, quero atualizar meu progresso em páginas, porcentagem ou tempo.                                         | M        | B12            |
| **B14** | Leitura        | Como usuário, quero iniciar uma releitura sem perder o histórico.                                                     | P        | B12            |
| **B15** | Desejos        | Como usuário, quero uma lista de desejos com prioridade e preço.                                                      | M        | B07            |
| **B16** | Desejos        | Como usuário, quero marcar como comprado e ver o livro na estante certa, em uma única ação.                           | M        | B15, B10       |
| **B17** | Metas          | Como usuário, quero criar metas anuais e mensais de livros e páginas e ver ritmo e situação.                          | G        | B12            |
| **B18** | Avaliação      | Como usuário, quero dar nota em meia estrela e ver o ranking geral.                                                   | P        | B12            |
| **B19** | Estatísticas   | Como usuário, quero ver totais e histórico por ano e comparar com a meta.                                             | M        | B12, B17       |
| **B20** | Onboarding     | Como novo usuário, quero um onboarding de 3 passos e telas vazias que me orientem.                                    | P        | B07            |
| **B21** | Importação     | Como usuário, quero importar planilha própria e CSV do Goodreads, com pré-visualização, relatório e desfazer.         | G        | B07            |
| **B22** | Painel         | Como usuário, quero um painel com lendo agora, metas e próximas leituras.                                             | M        | B13, B17       |
| **B23** | Segurança      | Como responsável, quero rate limit, validação Zod e cabeçalhos de segurança em todas as rotas.                        | M        | B01            |
| **B24** | Operação       | Como responsável, quero monitoramento de erros, desempenho, cotas de API e custo.                                     | M        | B01            |
| **B25** | Backup         | Como responsável, quero backup diário externo e restauração testada.                                                  | M        | B02            |
| **B26** | Acessibilidade | Como usuário, quero navegar tudo por teclado e com contraste AA (critério contínuo, não uma tarefa única).            | M        | contínuo       |

## 14.2 Critérios de aceite dos fluxos críticos

| **Cenário**                | **Dado**                                                             | **Quando**                                      | **Então**                                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Adicionar por ISBN**  | Usuário autenticado e ISBN-13 válido de edição existente no catálogo | Digita o ISBN e confirma                        | A edição aparece com capa, título e autor; o exemplar vai para a estante do formato; nenhuma chamada externa é feita se o livro já estava no catálogo interno. |
| **2. ISBN inválido**       | ISBN com dígito verificador errado                                   | Tenta confirmar                                 | Recebe mensagem clara e nenhuma consulta externa é disparada.                                                                                                  |
| **3. API fora do ar**      | Todos os provedores esgotam o tempo                                  | Tenta adicionar por ISBN                        | Em até 5 s vê a opção de cadastro manual com o ISBN preenchido.                                                                                                |
| **4. Duplicidade**         | Usuário já possui a edição                                           | Tenta adicionar de novo                         | Vê o aviso e escolhe entre cancelar e “é outro exemplar”.                                                                                                      |
| **5. Compra atômica**      | Item na lista de desejos                                             | Marca como comprado                             | O exemplar é criado, o desejo fica “comprado” e a estante mostra o livro; se algo falhar, nada muda.                                                           |
| **6. Releitura**           | Livro concluído em 2025                                              | Inicia nova leitura em 2026                     | Nova leitura criada; a anterior e a nota são preservadas; a meta de 2026 só conta se as releituras estiverem habilitadas.                                      |
| **7. Fuso horário**        | Usuário em São Paulo conclui um livro em 31/12 às 23:30              | Consulta as metas                               | O livro conta no ano que termina, não no seguinte.                                                                                                             |
| **8. Isolamento**          | Dois usuários, A e B                                                 | B tenta acessar por URL ou API um registro de A | Acesso negado; nenhum dado de A é retornado.                                                                                                                   |
| **9. Importação repetida** | Arquivo já importado com sucesso                                     | Importa o mesmo arquivo de novo                 | Nenhuma duplicata; o relatório mostra zero novos.                                                                                                              |
| **10. Exportação**         | Usuário com biblioteca completa                                      | Exporta em JSON e importa em uma conta vazia    | Biblioteca idêntica: livros, leituras, notas e metas.                                                                                                          |
| **11. Exclusão de conta**  | Usuário com dados                                                    | Confirma a exclusão                             | Dados removidos; login impossível; mensagem informa o prazo de expiração dos backups.                                                                          |
| **12. Sem WebGL (R1)**     | Navegador sem WebGL2                                                 | Abre a estante                                  | Vê a lista e a grade 2D completas, sem erro nem tela vazia.                                                                                                    |

# 15. Riscos e cuidados

Existem questões que precisam ser consideradas desde o início. As sete primeiras linhas vêm do original (com mitigação ampliada); as demais são novas. Probabilidade e impacto: A (alta), M (média), B (baixa).

| **Risco**                                | **Prob.** | **Imp.** | **Mitigação**                                                                                    | **Sinal de alerta**                        |
| ---------------------------------------- | --------- | -------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| **Catálogo incompleto**                  | M         | A        | Permitir cadastro manual e múltiplas fontes; medir a taxa de resolução de ISBN; spike da Fase 0. | Resolução abaixo de 85%                    |
| **Livros duplicados**                    | M         | M        | Usar ISBN, edição e validação de duplicidade (seção 8.6); mesclagem.                             | Fila de mesclagem crescendo                |
| **Estantes 3D pesadas**                  | A         | A        | Renderização otimizada e modo simplificado (seções 9.3 e 9.4).                                   | Menos de 30 fps nos aparelhos de teste     |
| **Informações incorretas de sagas**      | A         | B        | Permitir correção manual e confirmação do usuário; registrar a origem do dado.                   | Muitas edições manuais de séries           |
| **Perda de dados**                       | B         | A        | Backups externos e exportação da biblioteca (seção 6.7).                                         | Backup falhou ou restauração nunca testada |
| **Custos de hospedagem**                 | M         | A        | Monitorar consumo e estabelecer limites técnicos contra abusos (seção 16).                       | Custo acima de 50% do teto                 |
| **Direitos autorais**                    | M         | M        | Utilizar metadados e capas respeitando as condições das fontes (seção 8.7).                      | Notificação de titular de direitos         |
| **Escopo que cresce sem parar**          | A         | A        | Releases, backlog enxuto, lista de fora de escopo (2.5), revisão semanal.                        | R0 atrasa mais de 50% da estimativa        |
| **Limites e termos da hospedagem**       | A         | A        | Decidir hospedagem antes do público; plano de saída (seção 16).                                  | Aviso do provedor; projeto pausado         |
| **Dependência de APIs externas**         | M         | M        | Cache, fallback, mais de um provedor, cadastro manual.                                           | Mais de 5% de falhas nas consultas         |
| **Qualidade dos metadados em português** | A         | M        | Spike; curadoria; edição pelo usuário.                                                           | Muitos campos corrigidos à mão             |
| **Fricção de cadastro (ativação baixa)** | A         | A        | Câmera, importação e onboarding (módulo K).                                                      | Ativação abaixo da meta                    |
| **Retenção baixa (3D vira só novidade)** | M         | A        | Testar H1; entregar valor além do 3D (metas, estatísticas, progresso).                           | Retenção em 30 dias abaixo da meta         |
| **Segurança e vazamento de dados**       | B         | A        | Seção 11; revisão pré-lançamento.                                                                | Achado crítico em teste                    |
| **LGPD e menores de idade**              | M         | A        | Revisão jurídica; idade mínima; ECA Digital (seção 11.4).                                        | Parecer pendente perto do beta             |
| **Dependência de uma única pessoa**      | A         | M        | Documentação, ADRs, automação, código simples.                                                   | Ausência de mais de 2 semanas              |
| **Código gerado por IA com falhas**      | M         | M        | Revisão, testes, varredura de segredos, conferir pacotes antes de instalar.                      | Bugs recorrentes; dependências estranhas   |
| **Acessibilidade do 3D**                 | M         | M        | Alternativa em HTML e testes com leitor de tela.                                                 | Falha no teste de teclado                  |
| **Dependência de Supabase e Vercel**     | B         | M        | Esquema em SQL padrão, exportação, ambientes reproduzíveis.                                      | Mudança de preço ou de termos              |

# 16. Sustentabilidade, custos e limites **NOVO**

O original estabelece o modelo gratuito: manter os recursos disponíveis sem assinatura ou bloqueios premium. Entretanto, hospedagem, banco de dados e armazenamento têm custos, e é preciso planejar a sustentabilidade financeira antes de ampliar significativamente a quantidade de usuários. Esta seção faz essa conta e define o plano.

## 16.1 Direcionadores de custo

- Banco de dados (linhas e disco) e arquivos (capas).

- Tráfego de saída, principalmente imagens.

- Autenticação (usuários ativos por mês).

- Funções, jobs e cron.

- E-mail transacional, monitoramento, backup externo e domínio.

## 16.2 Limites dos planos gratuitos

Verificado em 06/11/2026 nas páginas oficiais; reconfirmar antes do lançamento, porque planos e preços mudam.

| **Serviço**          | **Limite ou regra**                                                                                                                                                              | **Impacto no projeto**                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Supabase Free**    | 500 MB de banco; 1 GB de arquivos; 50 mil usuários ativos por mês; 5 GB de tráfego (mais 5 GB em cache); projetos pausados após 1 semana sem atividade; sem backups automáticos. | A pausa derruba o site de um produto pouco usado; sem backup, rotina própria; o disco de arquivos esgota antes do banco. |
| **Supabase Pro**     | A partir de US\$ 25 por mês (preço de lista na data da consulta), com mais cota e backups automáticos.                                                                           | Provável passo obrigatório antes do lançamento público.                                                                  |
| **Vercel Hobby**     | Restrito a uso pessoal e não comercial; uso comercial exige plano pago.                                                                                                          | Doações, afiliados ou anúncios podem caracterizar uso comercial; confirmar nos termos ou com o suporte.                  |
| **Google Books API** | Cota padrão tipicamente de 1.000 consultas por dia por projeto.                                                                                                                  | Cache e outras fontes.                                                                                                   |
| **Open Library**     | Cerca de 1 requisição por segundo anônimo; cerca de 3 por segundo identificando o app.                                                                                           | Enviar User-Agent identificado.                                                                                          |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Conta de padeiro: o plano gratuito comporta um lançamento público?</strong></p>
<p>Premissas a medir: cerca de 50 KB por capa (duas miniaturas), 1 KB por linha no banco e cerca de 500 linhas por usuário com 200 livros (exemplares, leituras, avaliações e sessões).</p>
<p>Arquivos: 1 GB comporta da ordem de 20 mil capas. Banco: 500 MB comporta da ordem de 1.000 usuários com bibliotecas grandes.</p>
<p>Conclusão: o plano gratuito serve para desenvolvimento e para um beta pequeno. Um lançamento público exige plano pago, o que também resolve backups e pausa. Isso não contradiz o produto gratuito para o usuário; muda quem paga a conta.</p></td>
</tr>
</tbody>
</table>

## 16.3 Limites técnicos contra abuso

- Itens por biblioteca (sugestão: 5.000), tamanho de capa enviada (2 MB) e linhas por importação (2.000).

- Consultas externas por usuário por minuto; CAPTCHA no cadastro.

- Convite ou lista de espera durante o beta.

- Alertas de custo em 50%, 80% e 100% do teto.

- Chave de desligamento (kill switch) para 3D, importação e cada provedor externo.

## 16.4 Modelos de sustentabilidade compatíveis com “sem assinatura e sem bloqueios”

| **Modelo**                                   | **Como funciona**                                 | **A favor**                      | **Atenção**                                                               |
| -------------------------------------------- | ------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------- |
| **Doações voluntárias**                      | Pix ou plataforma de apoio, sem bloquear recursos | Simples e coerente com o produto | Receita imprevisível; pode contar como uso comercial em alguns provedores |
| **Apoiadores com benefícios só cosméticos**  | Temas de estante e decoração para quem apoia      | Não bloqueia funções             | Exige gestão de pagamentos                                                |
| **Links de afiliados na lista de desejos**   | “Onde comprar” identificado como afiliado         | Receita ligada ao uso            | Tensão com privacidade; sempre opcional e rotulado                        |
| **Patrocínio institucional**                 | Bibliotecas, editoras, projetos de leitura        | Escala maior                     | Dependência e conflito de interesse                                       |
| **Código aberto com hospedagem comunitária** | Quem quiser hospeda a própria instância           | Reduz custo de manutenção        | Mais trabalho de governança                                               |
| **Anúncios**                                 | Publicidade nas telas                             | Receita automática               | Contradiz a privacidade; não recomendado                                  |

Recomendação: começar com doações e custo mínimo, e decidir o modelo definitivo depois do beta, com o custo real por usuário ativo.

## 16.5 Plano de contingência

| **Gatilho**                                   | **Ação**                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Custo mensal acima de 80% do teto**         | Pausar importações grandes e novos cadastros (convite); revisar cache e imagens.                                               |
| **Cota de API esgotada**                      | Desligar o provedor; seguir com cache e cadastro manual.                                                                       |
| **Projeto pausado ou limite do plano**        | Migrar de plano e avisar os usuários.                                                                                          |
| **Mudança de termos ou de preço do provedor** | Executar o plano de migração (esquema em SQL padrão e exportação completa).                                                    |
| **Sem condições de continuar**                | Modo somente leitura com exportação garantida por pelo menos 90 dias e aviso antecipado: um compromisso público de exportação. |

# 17. Indicadores de sucesso

Também é importante definir como saberemos se o produto está funcionando. O original lista oito indicadores; esta versão acrescenta a definição, a meta inicial e o evento que mede cada um. As metas são hipóteses a calibrar no beta.

| **Indicador**                                   | **Definição operacional**                                            | **Meta inicial (hipótese)** | **Evento ou fonte**          |
| ----------------------------------------------- | -------------------------------------------------------------------- | --------------------------- | ---------------------------- |
| **Número de usuários cadastrados**              | Contas com e-mail verificado                                         | Acompanhar                  | signup_completed             |
| **Quantidade média de livros por biblioteca**   | Exemplares ÷ usuários com ao menos 1 livro                           | 25 ou mais no 30º dia       | Banco de dados               |
| **Percentual que cadastra pelo menos um livro** | Usuários com 1 ou mais exemplares nos 7 primeiros dias ÷ cadastrados | 70% ou mais                 | book_added                   |
| **Frequência de utilização**                    | Dias ativos por usuário nos 30 primeiros dias                        | 6 ou mais                   | session_started              |
| **Livros adicionados por mês**                  | Exemplares criados no mês                                            | Tendência de alta           | book_added                   |
| **Percentual de metas concluídas**              | Metas encerradas e atingidas ÷ metas encerradas                      | Acompanhar                  | goal_completed               |
| **Utilização das estantes 3D**                  | Sessões com 3D ativo ÷ sessões em estantes                           | 40% ou mais no celular (H4) | shelf_view                   |
| **Taxa de retorno**                             | Retenção em 1, 7 e 30 dias                                           | D30 de 20% ou mais          | session_started              |
| **Ativação**                                    | Usuários com 5 ou mais livros nos primeiros 7 dias                   | 40% ou mais                 | book_added                   |
| **Tempo até o primeiro livro**                  | Mediana entre criar a conta e o primeiro exemplar                    | 2 min ou menos              | signup_completed, book_added |
| **Resolução do catálogo**                       | ISBNs resolvidos automaticamente ÷ ISBNs consultados                 | 85% ou mais                 | isbn_lookup                  |
| **Desempenho percebido**                        | LCP no percentil 75                                                  | 2,5 s ou menos              | Web Vitals                   |
| **Estabilidade**                                | Sessões sem erro                                                     | 99,5% ou mais               | Rastreamento de erros        |
| **Custo por usuário ativo**                     | Custo mensal ÷ usuários ativos no mês                                | Definir no beta             | Painel de custos             |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>O indicador principal</strong></p>
<p>O original aponta a retenção como o principal indicador: quantas pessoas continuam utilizando a biblioteca depois de 30 dias. Isso continua valendo. A ativação foi acrescentada como indicador antecedente, porque quem não cadastra livros na primeira semana dificilmente chega ao 30º dia.</p></td>
</tr>
</tbody>
</table>

## 17.1 Eventos de analytics (sem dados pessoais) **NOVO**

| **Evento**                                             | **Quando dispara**                | **Propriedades permitidas**                                  |
| ------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------ |
| **signup_completed**                                   | Conta criada e e-mail verificado  | Método (e-mail ou social)                                    |
| **onboarding_step_completed**                          | Passo do onboarding concluído     | Número do passo                                              |
| **book_added**                                         | Exemplar criado                   | Método (isbn digitado, câmera, manual, importação) e formato |
| **isbn_lookup**                                        | Consulta de ISBN                  | Provedor, encontrou ou não, tempo em ms                      |
| **reading_started, reading_updated, reading_finished** | Mudanças de leitura               | Formato e unidade de progresso                               |
| **goal_created, goal_completed**                       | Meta criada ou atingida           | Tipo e período                                               |
| **shelf_view**                                         | Estante aberta                    | Modo (2D ou 3D) e nível do aparelho (0, 1, 2)                |
| **share_created, export_requested, account_deleted**   | Ações de saída e compartilhamento | Tipo                                                         |

Regra: nenhum evento carrega título, nota, nome ou qualquer dado pessoal.

# 18. Registro de decisões **NOVO**

## 18.1 Decisões já tomadas

| **ID**      | **Decisão**                                                                                      | **Origem**                        |
| ----------- | ------------------------------------------------------------------------------------------------ | --------------------------------- |
| **ADR-001** | Produto individual, sem rede social nem comunidade.                                              | Original                          |
| **ADR-002** | Gratuito, sem assinatura nem bloqueios premium.                                                  | Original (ver custos, seção 16)   |
| **ADR-003** | 3D opcional; o 2D sempre funciona.                                                               | Original                          |
| **ADR-004** | Banco de dados como fonte oficial; o 3D é uma representação.                                     | Original                          |
| **ADR-005** | A obra no catálogo é separada da relação com o usuário.                                          | Original (estendida na seção 7)   |
| **ADR-006** | Recomendações da primeira versão sem IA generativa, com pontuação configurável.                  | Original                          |
| **ADR-007** | Wireframes antes de programar as estantes 3D.                                                    | Original                          |
| **ADR-008** | Permitir exportar e compartilhar imagens de estantes e rankings.                                 | Original                          |
| **ADR-009** | Stack recomendada: Next.js, TypeScript, React Three Fiber, Supabase e Vercel.                    | Original (Vercel em aberto, D-06) |
| **ADR-010** | Contar ou não releituras na meta anual é escolha do usuário.                                     | Original                          |
| **ADR-011** | Nome do produto: ReadingFlow, com o slogan “A world of reading, organized.”, par do FinanceFlow. | Decidido em 06/11/2026            |
| **ADR-012** | Identidade visual: paleta Bordô Editorial (valores a definir).                                   | Decidido em 06/11/2026            |
| **ADR-013** | Banco de dados: Supabase (PostgreSQL gerenciado).                                                | Decidido em 07/11/2026            |

## 18.2 Decisões em aberto

| **Pendência**                                             | **Onde está descrita** | **Prazo sugerido** |
| --------------------------------------------------------- | ---------------------- | ------------------ |
| **Hospedagem (D-06)**                                     | Seções 6.3 e 16        | Antes do beta      |
| **Idade mínima (D-08)**                                   | Seção 11.4             | Antes do beta      |
| **Acesso a dados: supabase-js ou ORM (D-01)**             | Seção 6.3              | Fase 1             |
| **Governança do catálogo (D-02)**                         | Seção 6.3              | Fase 1             |
| **Valores de cor do Bordô Editorial e idioma do produto** | Seções 2.6 e 9.2       | Fase 1             |
| **Modelo de sustentabilidade**                            | Seção 16.4             | Depois do beta     |
| **Demais decisões D-03 a D-11**                           | Seção 6.3              | Conforme a fase    |

# 19. Próximas etapas

Neste momento temos uma especificação de produto consolidada, mas ainda não temos o design definitivo, o nome nem o protótipo funcional. A recomendação do original continua: começar pelos wireframes e não programar as estantes 3D antes de saber exatamente como será a experiência de navegação. O objetivo é sair da ideia conceitual e chegar a um protótipo visual consistente, que depois possa ser transformado em um site funcional.

## 19.1 Ordem de entrega

| **Etapa** | **Entrega**                  | **O que inclui**                                                                               |
| --------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| **00**    | Descoberta e spikes          | Entrevistas, concorrentes, spike do catálogo e do 3D, decisões de hospedagem e idade mínima.   |
| **01**    | Naming e identidade da marca | Definir nome, conceito, logotipo, paleta e tipografia.                                         |
| **02**    | Wireframes                   | Desenhar as telas principais antes de programar (seção 10.4).                                  |
| **03**    | Protótipo visual             | Construir a primeira demonstração navegável da plataforma.                                     |
| **04**    | Desenvolvimento do MVP-0     | Implementar cadastro, catálogo, estantes em 2D, lista de desejos, leitura, metas e importação. |
| **05**    | Estantes 3D (MVP-1)          | Camada 3D opcional sobre os mesmos dados.                                                      |

## 19.2 Sprint 0: checklist **NOVO**

- Criar o repositório, os ambientes e o CI mínimo.

- Preparar a lista de 200 ISBNs e o roteiro do spike do catálogo.

- Gerar 500 livros sintéticos e o roteiro do spike do 3D.

- Marcar de 8 a 10 entrevistas com leitores.

- Decidir a hospedagem provisória e registrar o ADR 0001.

## 19.3 Ritual de revisão semanal

O original sugere revisar o projeto toda semana: documentação, requisitos e decisões de desenvolvimento. Uma forma de fazer isso em 30 minutos:

1.  Registrar as decisões novas (seção 18).

2.  Reordenar o backlog das próximas duas semanas.

3.  Revisar os três maiores riscos (seção 15).

4.  Olhar indicadores e custos (seções 16 e 17).

5.  Atualizar este documento: versão e data.

## 19.4 Decisões para esta semana **NOVO**

- Hospedagem provisória (D-06).

- Acesso a dados: supabase-js com RLS ou ORM (D-01).

- Governança do catálogo (D-02).

- Direção para a idade mínima (D-08), para levar ao parecer jurídico.

- Confirmar o escopo do R0 (seção 3.3).

# Apêndice A. Esquema SQL inicial

O esquema completo está no arquivo `supabase/migrations/20261107120000_schema_inicial.sql`. Ele é a fonte da verdade do modelo de dados (seção 7).

# Apêndice B. Fontes de dados e integrações **NOVO**

| **Fonte**                                       | **O que oferece**                                                                                                        | **Uso sugerido**                                                       | **Atenção**                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **BrasilAPI (ISBN)**                            | Consulta que agrega CBL, Mercado Editorial, Open Library e Google Books; devolve metadados e, quando existem, dimensões. | Primeira tentativa para ISBN brasileiro (hipótese a validar no spike). | Serviço gratuito e comunitário, sem SLA conhecido. Verificado em 06/11/2026.                                                       |
| **Google Books API**                            | Títulos, autores, capas, sinopses, categorias.                                                                           | Segunda fonte e complemento de sinopse e gênero.                       | Cota padrão de cerca de 1.000 consultas por dia por projeto; respeitar os termos (atribuição, uso de capas). Chave só no servidor. |
| **Open Library**                                | Metadados, edições, identificadores e capas.                                                                             | Terceira fonte e capas.                                                | Identificar o app no User-Agent; cachear. Verificado em 06/11/2026.                                                                |
| **Hardcover (API GraphQL)**                     | Candidata para séries e metadados.                                                                                       | Avaliar no spike de séries.                                            | Não verificada: checar termos, limites e estabilidade.                                                                             |
| **Wikidata**                                    | Candidata para séries e ordem de leitura.                                                                                | Avaliar no spike de séries.                                            | Não verificada: qualidade irregular; conferir licença e cobertura.                                                                 |
| **Exportações de Goodreads e StoryGraph (CSV)** | Biblioteca do próprio usuário, com notas e datas.                                                                        | Importação por arquivo (módulo K).                                     | Sem API: só arquivo enviado pelo usuário; conferir o formato atual.                                                                |
| **Skoob, Kindle, serviços de áudio**            | Acervos de outras plataformas.                                                                                           | Avaliar a viabilidade (R2).                                            | Verificar se existe exportação oficial; nunca pedir a senha do usuário.                                                            |

# Apêndice C. Brief para agentes de código **NOVO**

Se o desenvolvimento for assistido por IA ou por um agente de código, um arquivo de instruções na raiz do repositório reduz erros. Um ponto de partida, para adaptar:

> \# AGENTS.md: ReadingFlow
>
> \## Contexto
>
> Biblioteca pessoal digital (livros físicos, e-books, audiobooks) com estantes 3D opcionais.
>
> Individual, sem rede social. Fonte da verdade: PostgreSQL (Supabase). O 3D só apresenta dados.
>
> Especificação completa: docs/produto/. Escopo atual: R0 (2D, sem 3D).
>
> \## Stack
>
> Next.js (App Router) + React + TypeScript estrito; Tailwind; Zod; Supabase (Auth, Postgres, Storage).
>
> 3D (R1): React Three Fiber, carregado sob demanda, sem SSR.
>
> \## Regras obrigatórias
>
> \- Chaves privilegiadas só no servidor. Nunca no cliente, nunca no repositório.
>
> \- Acesso a dados por consultas parametrizadas ou ORM. Nunca concatenar SQL.
>
> \- Validar toda entrada no servidor com Zod.
>
> \- RLS em toda tabela, com teste. Todo registro do usuário tem user_id.
>
> \- Não usar user_metadata para autorização.
>
> \- Nunca confiar em user_id vindo do cliente.
>
> \- Não instalar pacote sem conferir que existe, é mantido e é necessário.
>
> \- Texto de usuário nunca vira HTML sem sanitização. Exportar CSV neutralizando = + - @.
>
> \## Qualidade
>
> \- Mobile-first. Teclado e leitor de tela em tudo. Contraste AA (ver tokens na seção 9.2).
>
> \- Textos em pt-BR, externalizados. Datas no fuso do perfil do usuário.
>
> \- Regras de negócio em funções puras com teste (Vitest). Fluxos críticos com Playwright.
>
> \- Mudanças pequenas, uma por pull request, com migração versionada quando tocar o banco.
>
> \## Como trabalhar
>
> \- Antes de codar: reler os critérios de aceite da história.
>
> \- Em dúvida de produto ou de segurança, perguntar em vez de supor.
>
> \- Não adicionar funcionalidade fora do escopo atual.
>
> \- Registrar decisões relevantes em docs/adr/.

# Apêndice D. Checklist de lançamento **NOVO**

<table>
<colgroup>
<col style="width: 17%" />
<col style="width: 82%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Área</strong></th>
<th><strong>Item</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Produto</strong></td>
<td><p>☐ Critérios de saída do beta atendidos.</p>
<p>☐ Fluxos críticos (seção 10.2) validados por pessoas de fora.</p>
<p>☐ Onboarding e importação testados com acervos reais.</p></td>
</tr>
<tr class="even">
<td><strong>Segurança</strong></td>
<td><p>☐ RLS testada em todas as tabelas.</p>
<p>☐ Nenhum segredo no repositório; chaves rotacionadas.</p>
<p>☐ Rate limit, CAPTCHA e cabeçalhos de segurança ativos.</p>
<p>☐ Revisão do modelo de ameaças (seção 11.2).</p></td>
</tr>
<tr class="odd">
<td><strong>Dados</strong></td>
<td><p>☐ Backup diário externo funcionando e restauração testada.</p>
<p>☐ Exportação e exclusão de conta testadas ponta a ponta.</p>
<p>☐ Plano de produção adequado (sem pausa por inatividade).</p></td>
</tr>
<tr class="even">
<td><strong>Legal</strong></td>
<td><p>☐ Política de Privacidade e Termos publicados, com aceite versionado.</p>
<p>☐ Encarregado e canal de contato definidos.</p>
<p>☐ Idade mínima e ECA Digital avaliados com apoio jurídico.</p>
<p>☐ Lista de operadores e transferência internacional revisada.</p></td>
</tr>
<tr class="odd">
<td><strong>Qualidade</strong></td>
<td><p>☐ Lighthouse e axe dentro das metas.</p>
<p>☐ 3D validado em aparelhos reais; alternativa 2D testada.</p>
<p>☐ Teste com leitor de tela e teclado.</p></td>
</tr>
<tr class="even">
<td><strong>Operação</strong></td>
<td><p>☐ Monitoramento, alertas e runbooks prontos.</p>
<p>☐ Alertas de custo e cotas de API ativos; chaves de desligamento testadas.</p>
<p>☐ Canal de suporte e plano de comunicação de incidentes.</p></td>
</tr>
<tr class="odd">
<td><strong>Custos</strong></td>
<td><p>☐ Hospedagem compatível com o uso (termos do plano).</p>
<p>☐ Teto mensal definido e modelo de sustentabilidade escolhido.</p></td>
</tr>
</tbody>
</table>

# Apêndice E. Glossário **NOVO**

| **Termo**                   | **Significado**                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| **Obra (work)**             | O livro como criação literária, independente de edição ou formato.                              |
| **Edição (edition)**        | Uma publicação específica de uma obra: ISBN, editora, formato, páginas ou duração.              |
| **Exemplar (library item)** | A cópia de uma edição que o usuário possui ou possuiu.                                          |
| **Leitura (reading)**       | Uma passagem do usuário por uma obra, do início ao fim ou ao abandono.                          |
| **Sessão**                  | Um registro de leitura dentro de uma leitura (quanto e quando).                                 |
| **Releitura**               | Nova leitura de uma obra já lida.                                                               |
| **Abandonado (DNF)**        | Leitura interrompida sem conclusão.                                                             |
| **TBR**                     | “To be read”: fila de livros que o usuário pretende ler.                                        |
| **RLS**                     | Row Level Security: o banco decide, linha a linha, quem pode ler ou escrever.                   |
| **RPC**                     | Função do banco chamada pela aplicação, usada para operações transacionais.                     |
| **Catálogo global**         | Obras e edições compartilhadas, escritas só pelo servidor.                                      |
| **Entrada privada**         | Obra ou edição criada pelo usuário e visível só para ele.                                       |
| **MVP**                     | Produto mínimo viável: a menor versão que entrega valor real.                                   |
| **PWA**                     | Site instalável que usa recursos do aparelho, como a câmera.                                    |
| **Spike**                   | Experimento curto para reduzir uma incerteza técnica.                                           |
| **ADR**                     | Registro de decisão de arquitetura.                                                             |
| **LCP, INP, CLS**           | Métricas de experiência do Core Web Vitals: carregamento, interatividade e estabilidade visual. |
| **Lombada procedural**      | Lombada gerada por código a partir da cor da capa, do título e do autor.                        |
| **Cold start**              | Situação de usuário novo, sem histórico para recomendar.                                        |
| **BFF**                     | Camada de servidor que atende só às necessidades da interface.                                  |

# Apêndice F. Referências **NOVO**

Fontes consultadas em 06/11/2026 para os limites, preços e regras citados. Reconfirmar antes de decisões irreversíveis.

Supabase, preços e limites dos planos: [supabase.com/pricing](https://supabase.com/pricing)

Supabase, segurança de linha (RLS): [supabase.com/docs/guides/database/postgres/row-level-security](https://supabase.com/docs/guides/database/postgres/row-level-security)

Vercel, política de uso justo e plano Hobby: [vercel.com/docs/limits/fair-use-guidelines](https://vercel.com/docs/limits/fair-use-guidelines)

Open Library, API para desenvolvedores: [openlibrary.org/developers/api](https://openlibrary.org/developers/api)

Google Books API: [developers.google.com/books](https://developers.google.com/books)

BrasilAPI: [brasilapi.com.br/docs](https://brasilapi.com.br/docs)

LGPD, Lei 13.709/2018: [planalto.gov.br](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)

ECA Digital: Lei nº 15.211, de 17/09/2025, em vigor desde 17/03/2026 (consultar o texto no Planalto ou no Diário Oficial da União).

WCAG 2.2: [w3.org/TR/WCAG22](https://www.w3.org/TR/WCAG22/)

Core Web Vitals: [web.dev/articles/vitals](https://web.dev/articles/vitals)

OWASP ASVS: [owasp.org](https://owasp.org/www-project-application-security-verification-standard/)
