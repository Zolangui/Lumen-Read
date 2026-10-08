# Como ler EPUB no Firefox com o Lumen Read

[English](getting-started.md)

O Lumen Read é um leitor gratuito e de código aberto para livros EPUB locais.
Comece com um livro: não precisa migrar sua biblioteca, criar conta do Lumen
ou configurar uma chave de IA. Este guia é para Firefox no computador. Os
nomes dos controles podem variar conforme a versão e o idioma instalados.

## Abra seu primeiro livro

1. [Instale pela loja Firefox Add-ons](https://addons.mozilla.org/firefox/addon/lumen-read/?utm_source=github&utm_medium=guide&utm_content=getting-started-pt&utm_campaign=reader-first).
   Use a versão do Firefox exigida pela página da loja.
2. Clique no ícone do Lumen Read na barra do navegador. Se estiver oculto,
   procure-o no menu de extensões. O leitor abre em uma aba.
3. Na biblioteca, escolha **Adicionar Novo Livro**, selecione seu `.epub`
   e clique no livro importado para ler. Também pode arrastar um EPUB para
   a biblioteca.

Use um livro que você tenha permissão para ler. O Lumen não é uma livraria,
conversor de PDF ou removedor de DRM. Livros de lojas/bibliotecas que exigem
um aplicativo autorizado específico não são necessariamente compatíveis.

## Ajuste a leitura ao seu conforto

Abra **Tipografia** na barra lateral para ajustar fonte, tamanho, espaçamento
e página única/dupla. Comece apenas pelo tamanho e pela visualização de que
precisa; não é necessário configurar tudo. Uma janela estreita pode não ter
espaço suficiente para uma boa visualização dupla.

Escolha **Livro** para preferências desse livro ou **Geral** para os padrões.
Configurações específicas do livro podem prevalecer sobre as globais. Use
**Redefinir para Global** para voltar a seguir esses padrões.

Abra **Tema** para escolher cores de leitura. A página geral de configurações
também permite selecionar o esquema claro, escuro ou do sistema. Para ler com
foco, experimente o modo Zen; pressione **Esc** para sair. Zen e tela cheia
são controles diferentes.

O livro pode ter fontes próprias, quadros coloridos e ilustrações. Em um EPUB
com texto refluível, as quebras de página podem mudar com a fonte e a janela;
não precisam corresponder à edição impressa. EPUB também admite layout fixo.
Veja a [especificação de layouts da W3C](https://www.w3.org/TR/epub-33/#sec-layout).

### Se algum texto ficar difícil de ler no tema escuro

Nas versões que oferecem **Apresentação adaptativa (Beta)** em Tema, você
pode ativá-la para tentar melhorar a legibilidade preservando características
visuais importantes do livro. É opcional e não garante correção de qualquer
EPUB. Desative para comparar a leitura sem Adaptive. Se o controle não
aparecer, confira a versão instalada: o guia não anuncia que um update já
está disponível na loja.

## Guarde um trecho e volte a ele

Selecione um texto para abrir o menu de seleção e criar um destaque ou nota.
Abra **Anotações** para ver os registros salvos desse livro e clique em um
deles para voltar ao trecho. Isso não significa que as notas podem ser
transferidas para qualquer outro leitor.

## Saiba onde seus dados ficam

Por padrão, livros e dados comuns de leitura ficam nesse perfil do navegador.
Guarde os arquivos EPUB originais separadamente. Remover a extensão, apagar
dados do perfil ou usar **limpar cache** pode remover dados locais de leitura.
Não use limpar cache como uma correção inofensiva para problemas de aparência.

Baixar o EPUB original não é uma exportação demonstrada de notas e destaques.
Não presuma que eles serão recebidos por outro leitor ou computador. A
sincronização com Dropbox é opcional; confira o comportamento documentado e
verifique seus dados antes de depender dela como backup ou migração.

IA remota e Dropbox têm escolhas e permissões separadas. Quando ativados,
enviam os dados selecionados aos respectivos serviços. Não precisa configurar
nenhum dos dois para ler normalmente.

## Se um livro não funcionar como esperado

[Abra um problema no GitHub](https://github.com/Zolangui/Lumen-Read/issues/new) com:

- Versões do Firefox, sistema operacional e Lumen.
- Passos, resultado esperado e o que aconteceu.
- Tema, janela/layout e se o Adaptive estava ativado, quando disponível.
- Uma imagem sem dados pessoais ou exemplo público autorizado.

Não envie EPUB comercial, notas privadas, chave de API ou token de conta.
É possível relatar um problema sem compartilhar o livro inteiro. As
estatísticas são estimativas, não medidas de compreensão nem paginação
impressa exata.

[Voltar ao projeto](../../README.md)
