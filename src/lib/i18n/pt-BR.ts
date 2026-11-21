export const ptBR = {
  brand: {
    name: "ReadingFlow",
    slogan: "A world of reading, organized.",
    subtitle:
      "Sua biblioteca pessoal de livros físicos, e-books e audiobooks em um só lugar, privada e sem rede social.",
  },
  nav: {
    skipToContent: "Pular para o conteúdo principal",
    dashboard: "Painel",
    shelves: "Estantes",
    addBook: "Adicionar",
    reading: "Leitura",
    wishlist: "Desejos",
    goals: "Metas",
    stats: "Estatísticas",
    import: "Importar",
    settings: "Configurações",
  },
  formats: {
    hardcover: "Capa dura",
    paperback: "Brochura",
    pocket: "Bolso",
    ebook: "E-book",
    audiobook: "Audiobook",
    box: "Box",
    other: "Outro",
  },
  shelves: {
    physical: "Estante Física",
    digital: "Estante Digital",
    audio: "Audiobooks",
    viewGrid: "Grade",
    viewList: "Lista",
    emptyTitle: "Sua estante aguarda o primeiro volume",
    emptyDescription:
      "Adicione pelo ISBN, escaneie o código de barras com a câmera ou cadastre manualmente.",
  },
  readingStatus: {
    not_started: "Não iniciado",
    reading: "Lendo agora",
    paused: "Pausado",
    finished: "Concluído",
    abandoned: "Abandonado",
  },
  progressUnits: {
    pages: "Páginas",
    percent: "Porcentagem (%)",
    seconds: "Tempo ouvido",
  },
  goals: {
    ahead: "Ritmo adiantado em relação ao planejado",
    on_track: "No ritmo planejado",
    behind: "Ritmo em ajuste — siga no seu tempo",
    completed: "Meta cumprida",
  },
  validation: {
    requiredTitle: "Informe o título da obra.",
    requiredAuthor: "Informe ao menos o autor principal.",
    invalidIsbn:
      "ISBN inválido. Confira os 10 ou 13 dígitos e o dígito verificador.",
    invalidRating:
      "A nota deve estar entre 0,5 e 5,0 em passos de meia estrela.",
    invalidDates: "A data de conclusão não pode ser anterior à data de início.",
    termsRequired:
      "É necessário aceitar os Termos de Uso e a Política de Privacidade.",
    minimumAge:
      "É necessário declarar ter pelo menos 16 anos para criar a conta.",
  },
  landingRoom: {
    tagline: "Leia. Acompanhe. Evolua.",
    subtitle:
      "Sua biblioteca pessoal silenciosa para livros físicos, e-books e audiobooks.",
    primaryCta: "Entrar na biblioteca",
    secondaryCta: "Criar conta",
    authenticatedCta: "Abrir meu acervo",
    hintDesktop:
      "Passe o cursor sobre uma lombada · Puxe o cordão para apagar ou acender a luz",
    hintMobile: "Toque em uma lombada · Puxe o cordão da luminária",
    lampTurnOff: "Apagar luminária pendente (puxe ou clique)",
    lampTurnOn: "Acender luminária pendente (puxe ou clique)",
    lampOffBadge: "Luz apagada · Puxe o cordão para acender",
    soundMute: "Silenciar sons do ambiente",
    soundUnmute: "Ativar sons do ambiente",
    openMenu: "Abrir menu de navegação",
    closeMenu: "Fechar menu de navegação",
    aboutLink: "Sobre",
    contactLink: "Contato",
    helpLink: "Ajuda e perguntas",
    termsLink: "Termos de uso",
    privacyLink: "Privacidade",
    aboutTitle: "Sobre o ReadingFlow",
    aboutBody:
      "O ReadingFlow nasceu para leitores que desejam o aconchego de uma biblioteca particular aliado à organização precisa do seu acervo. Catalogue livros físicos por ISBN, acompanhe e-books e audiobooks em múltiplas unidades, registre releituras e mantenha posse integral dos seus dados sem ruído de rede social.",
    contactTitle: "Contato e Privacidade",
    contactBody:
      "Construído com privacidade por padrão em conformidade com a LGPD. Seus registros de leitura, notas e avaliações pertencem exclusivamente a você, com exportação completa em JSON e CSV a qualquer momento.",
    modalAddCta: "Adicionar à minha estante",
    modalBackBtn: "Voltar à estante",
    modalCloseAria: "Fechar detalhes do livro",
    modalSpinBtn: "Virar livro 3D",
    modalInspectHint: "Arraste ou mova o cursor sobre o livro para inspecionar",
    modalProgressLabel: "Experimente marcar páginas lidas",
  },
} as const;

export type Dictionary = typeof ptBR;
