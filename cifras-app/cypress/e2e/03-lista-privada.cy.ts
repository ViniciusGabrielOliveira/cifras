describe('Lista Privada — criar, adicionar música, compartilhar', () => {
  let uid: string;
  let cifraId: string;

  beforeEach(() => {
    cy.task<string>('seedDocument', {
      collection: 'cifras',
      data: {
        titulo: 'Kyrie Eleison',
        artista: 'Artista Teste',
        tom: 'G',
        instrumento: 'violao',
        dificuldade: 'basico',
        composicao: '',
        secoes: [],
        status: 'publica',
      },
    }).then((id) => {
      cifraId = id;
    });

    cy.seedAndLogin({ role: 'membro' }).then((id) => {
      uid = id;
    });
  });

  it('cria uma lista privada e ela aparece no painel', () => {
    cy.visit('/admin/painel');

    cy.contains('button', 'Nova Lista').first().click();
    cy.get('.nova-lista-form input.form-input').type('Minha Lista E2E');
    cy.contains('button', 'Criar Lista').click();

    cy.contains('Minha Lista E2E', { timeout: 10000 }).should('be.visible');
  });

  it('abre a lista privada e exibe o link de convite no painel de participantes', () => {
    const tokenConvite = 'tok-teste-123';

    cy.task('setDocument', {
      collection: 'listas',
      id: 'lista-privada-e2e',
      data: {
        titulo: 'Lista Privada E2E',
        tipo: 'privada',
        donoUid: uid,
        donoNome: 'Test User',
        tokenConvite,
        musicas: [],
        participantes: [{ uid, nome: 'Test User', role: 'editor' }],
        participantesUids: [uid],
        criadaEm: new Date().toISOString(),
        atualizadaEm: new Date().toISOString(),
      },
    }).then(() => {
      cy.visit('/minha-area/lista/lista-privada-e2e');
    });

    cy.contains('Lista Privada E2E', { timeout: 10000 }).should('be.visible');

    cy.get('button.btn-participantes').click();

    cy.get('.invite-input', { timeout: 6000 })
      .should('be.visible')
      .invoke('val')
      .should('include', `/join/${tokenConvite}`);
  });
});
