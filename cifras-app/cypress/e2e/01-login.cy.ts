describe('Login / Logout', () => {
  beforeEach(() => {
    cy.task('seedTestUser', {
      email: 'membro@cifras.dev',
      password: 'Senha@123',
      displayName: 'Membro Teste',
      role: 'membro',
    });
  });

  it('faz login com email e senha e redireciona para o painel', () => {
    cy.visit('/admin');
    cy.get('input#email').should('be.visible').clear().type('membro@cifras.dev');
    cy.get('input#senha').type('Senha@123');
    cy.contains('button', 'Entrar').click();

    cy.url().should('include', '/admin/painel', { timeout: 10000 });
    cy.contains('Membro Teste').should('be.visible');
  });

  it('exibe erro ao usar credenciais inválidas', () => {
    cy.visit('/admin');
    cy.get('input#email').type('membro@cifras.dev');
    cy.get('input#senha').type('senha-errada');
    cy.contains('button', 'Entrar').click();

    cy.contains('Email ou senha incorretos').should('be.visible');
    cy.url().should('include', '/admin');
  });

  it('faz logout e volta para a página de login', () => {
    cy.loginViaUI('membro@cifras.dev', 'Senha@123');
    cy.url().should('include', '/admin/painel');

    cy.contains('button', 'Sair').click();
    cy.url().should('match', /\/admin$/, { timeout: 8000 });
    cy.contains('Painel Administrativo').should('be.visible');
  });
});
