export const IMG_W = 2576;
export const IMG_H = 1449;

export const alas = [
  {
    id: "classicos",
    nome: "Clássicos",
    x: 655,
    y: 365,
    w: 323,
    h: 150,
    livro: {
      titulo: "Orgulho e Preconceito",
      autor: "Jane Austen",
      cor: "#1E352F",
      txt: "#E9DFC8",
    },
    sinopse:
      "Elizabeth Bennet e o orgulhoso Sr. Darcy se desentendem à primeira vista. Entre bailes e cartas, Austen faz dos bons modos uma comédia afiada sobre dinheiro, casamento e preconceito.",
  },
  {
    id: "brasiliana",
    nome: "Brasiliana",
    x: 995,
    y: 400,
    w: 117,
    h: 114,
    livro: {
      titulo: "Grande Sertão: Veredas",
      autor: "João Guimarães Rosa",
      cor: "#5A3B24",
      txt: "#F1E3C6",
    },
    sinopse:
      "Riobaldo, ex-jagunço, conta a vida a um visitante e volta sempre à mesma dúvida: houve ou não um pacto com o diabo? Um romance escrito numa língua que só existe nele.",
  },
  {
    id: "filosofia",
    nome: "Filosofia",
    x: 630,
    y: 525,
    w: 176,
    h: 303,
    livro: {
      titulo: "Meditações",
      autor: "Marco Aurélio",
      cor: "#3B3A36",
      txt: "#EDE6D6",
    },
    sinopse:
      "Anotações de um imperador que escrevia para si mesmo, entre campanhas militares. Um manual breve de estoicismo sobre disciplina, perda e o que está ao nosso alcance.",
  },
  {
    id: "fantasia",
    nome: "Fantasia",
    x: 995,
    y: 528,
    w: 211,
    h: 144,
    livro: {
      titulo: "O Hobbit",
      autor: "J.R.R. Tolkien",
      cor: "#2F4A3A",
      txt: "#F0E2B8",
    },
    sinopse:
      "Bilbo Bolseiro, um hobbit caseiro, é arrastado por treze anões e um mago atrás de um tesouro vigiado por um dragão. A aventura que abre caminho para O Senhor dos Anéis.",
  },
  {
    id: "ficcao",
    nome: "Ficção",
    x: 820,
    y: 684,
    w: 386,
    h: 144,
    livro: {
      titulo: "1984",
      autor: "George Orwell",
      cor: "#7A2E24",
      txt: "#F4EAD8",
    },
    sinopse:
      "Winston Smith reescreve o passado para um Estado que vigia até o pensamento. Quando ele se permite lembrar e desejar, a distopia mostra o preço.",
  },
  {
    id: "terror",
    nome: "Terror & Gótico",
    x: 630,
    y: 840,
    w: 358,
    h: 150,
    livro: {
      titulo: "Drácula",
      autor: "Bram Stoker",
      cor: "#2A1F2B",
      txt: "#E6D5C3",
    },
    sinopse:
      "Um advogado visita um castelo nos Cárpatos e volta com uma ameaça que cruza o mar até a Inglaterra. Contado em cartas, diários e recortes de jornal.",
  },
] as const;

export type Ala = (typeof alas)[number];
