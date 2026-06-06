describe('Visualizar lista do dia → abrir cifra → transpor tom', () => {
  let cifraId: string;
  let listaId: string;

  beforeEach(() => {
    const today = new Date().toISOString().slice(0, 10);

    cy.task<string>('seedDocument', {
      collection: 'cifras',
      data: {
        titulo: 'Aleluia Teste',
        artista: 'Artista Teste',
        tom: 'C',
        instrumento: 'violao',
        dificuldade: 'basico',
        composicao: '',
        secoes: [
          {
            tipo: 'verso',
            label: 'Verso 1',
            linhas: [{ letra: 'Aleluia!', acordes: [{ posicao: 0, acorde: 'C' }] }],
          },
        ],
        status: 'publica',
      },
    }).then((id) => {
      cifraId = id;

      cy.task<string>('seedDocument', {
        collection: 'listas',
        data: {
          titulo: 'Lista do Dia Teste',
          tipo: 'publica',
          dataInicio: today,
          dataFim: today,
          categoria: 'dominical',
          musicas: [
            {
              id: 'musica-1',
              cifraId: id,
              nome: 'Aleluia Teste',
              autor: 'Artista Teste',
              parte: 'entrada',
              ordem: 0,
            },
          ],
          criadaEm: new Date().toISOString(),
          atualizadaEm: new Date().toISOString(),
        },
      }).then((lId) => {
        listaId = lId;
      });
    });
  });

  it('exibe a lista do dia na home com a cifra no acordeon', () => {
    cy.visit('/');

    cy.contains('Lista do Dia Teste', { timeout: 10000 }).should('be.visible');
    cy.contains('Aleluia Teste').should('be.visible');
  });

  it('expande a cifra e usa o controle de tom para transpor', () => {
    cy.visit('/');

    cy.contains('Aleluia Teste', { timeout: 10000 }).click();

    cy.get('.controle-tom', { timeout: 10000 }).should('be.visible');
    cy.get('.tom-atual').should('contain', 'C');

    cy.get('button[aria-label="Meio tom acima"]').click();
    cy.get('.tom-atual').should('contain', 'C#');

    cy.get('button[aria-label="Meio tom abaixo"]').click();
    cy.get('.tom-atual').should('contain', 'C');
  });

  it('restaura o tom original após transpor', () => {
    cy.visit('/');

    cy.contains('Aleluia Teste', { timeout: 10000 }).click();

    cy.get('button[aria-label="Meio tom acima"]').click();
    cy.get('button[aria-label="Meio tom acima"]').click();
    cy.get('.tom-atual').should('contain', 'D');

    cy.contains('button', 'Restaurar').click();
    cy.get('.tom-atual').should('contain', 'C');
    cy.contains('button', 'Restaurar').should('not.exist');
  });
});
