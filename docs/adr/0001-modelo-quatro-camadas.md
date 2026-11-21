# Modelo em quatro camadas: Obra, Edição, Exemplar e Leitura

Separamos o domínio central em quatro entidades distintas (`Work`, `Edition`, `LibraryItem` e `Reading`) em vez de uma tabela única `user_books`. Posse e leitura têm ciclos de vida independentes (é possível ler um livro emprestado sem possuí-lo, possuir três edições da mesma obra ou reler o mesmo exemplar em anos distintos), e essa separação impede inflar obras únicas, páginas lidas ou metas anuais.
