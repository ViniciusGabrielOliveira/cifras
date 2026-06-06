describe('Admin — criar cifra e aparecer no índice', () => {
  beforeEach(() => {
    cy.seedAndLogin({
      email: 'editor@cifras.dev',
      displayName: 'Editor Teste',
      role: 'editor',
    });
  });

  it('cria uma nova cifra pelo editor e ela aparece no índice', () => {
    cy.visit('/admin/nova-cifra');

    cy.get('input[placeholder="Ex: Aleluia Festivo"]', { timeout: 8000 }).type('Santo E2E');
    cy.get('input[placeholder="Ex: Padre Zezinho"]').type('Artista Teste');

    cy.contains('button', 'Salvar').click();

    cy.url().should('include', '/admin/painel', { timeout: 10000 });

    cy.task<unknown[]>('queryCollection', {
      collection: 'cifras_indice',
      field: 'titulo',
      value: 'Santo E2E',
    }).then((docs) => {
      expect(docs).to.have.length.greaterThan(0);
    });
  });

  it('edita uma cifra existente e salva', () => {
    cy.task<string>('seedDocument', {
      collection: 'cifras',
      data: {
        titulo: 'Cifra Original',
        artista: 'Artista',
        tom: 'A',
        instrumento: 'violao',
        dificuldade: 'basico',
        composicao: '',
        secoes: [],
        status: 'publica',
      },
    }).then((cifraId) => {
      cy.visit(`/admin/editar-cifra/${cifraId}`);
    });

    cy.get('input[placeholder="Ex: Aleluia Festivo"]', { timeout: 8000 })
      .clear()
      .type('Cifra Editada E2E');

    cy.contains('button', 'Salvar').click();
    cy.url().should('include', '/admin/painel', { timeout: 10000 });

    cy.task<unknown[]>('queryCollection', {
      collection: 'cifras',
      field: 'titulo',
      value: 'Cifra Editada E2E',
    }).then((docs) => {
      expect(docs).to.have.length.greaterThan(0);
    });
  });
});
