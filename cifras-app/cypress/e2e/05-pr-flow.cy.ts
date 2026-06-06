describe('Fluxo de PR — submeter e admin aprovar', () => {
  let autorUid: string;
  let adminUid: string;
  let prId: string;

  beforeEach(() => {
    cy.task<string>('seedTestUser', {
      email: 'autor@cifras.dev',
      password: 'Senha@123',
      displayName: 'Autor PR',
      role: 'membro',
    }).then((uid) => {
      autorUid = uid;

      return cy.task<string>('seedTestUser', {
        email: 'admin@cifras.dev',
        password: 'Senha@123',
        displayName: 'Admin Teste',
        role: 'admin',
      });
    }).then((uid) => {
      adminUid = uid;

      return cy.task<string>('seedDocument', {
        collection: 'cifras_pr',
        data: {
          cifraId: null,
          tipo: 'nova_cifra',
          dados: {
            titulo: 'Glória E2E',
            artista: 'Artista PR',
            tom: 'D',
            instrumento: 'violao',
            dificuldade: 'basico',
            composicao: '',
            secoes: [],
            status: 'pendente_revisao',
          },
          autorUid,
          autorNome: 'Autor PR',
          status: 'pendente',
          criadoEm: new Date().toISOString(),
        },
      });
    }).then((id) => {
      prId = id;
    });
  });

  it('admin vê a PR pendente na lista de solicitações', () => {
    cy.loginViaUI('admin@cifras.dev', 'Senha@123');
    cy.visit('/admin/prs');

    cy.contains('Glória E2E', { timeout: 10000 }).should('be.visible');
    cy.contains('Autor PR').should('be.visible');
  });

  it('admin aprova a PR e a cifra é criada', () => {
    cy.loginViaUI('admin@cifras.dev', 'Senha@123');
    cy.visit('/admin/prs');

    cy.contains('Glória E2E', { timeout: 10000 }).click();

    cy.contains('button', 'Aprovar e publicar', { timeout: 8000 }).click();

    cy.contains('aprovad', { timeout: 10000 }).should('be.visible');

    cy.task<{ status: string }>('getFirestoreDoc', {
      collection: 'cifras_pr',
      id: prId,
    }).then((doc) => {
      expect(doc!.status).to.eq('aprovado');
    });

    cy.task<unknown[]>('queryCollection', {
      collection: 'cifras',
      field: 'titulo',
      value: 'Glória E2E',
    }).then((docs) => {
      expect(docs).to.have.length.greaterThan(0);
    });
  });

  it('admin rejeita a PR e o status fica rejeitado', () => {
    cy.loginViaUI('admin@cifras.dev', 'Senha@123');
    cy.visit('/admin/prs');

    cy.contains('Glória E2E', { timeout: 10000 }).click();

    cy.contains('button', 'Rejeitar', { timeout: 8000 }).click();

    cy.task<{ status: string }>('getFirestoreDoc', {
      collection: 'cifras_pr',
      id: prId,
    }).then((doc) => {
      expect(doc!.status).to.eq('rejeitado');
    });
  });
});
