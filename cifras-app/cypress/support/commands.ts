/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      loginViaUI(email: string, password: string): Chainable<void>;
      seedAndLogin(options?: { email?: string; password?: string; displayName?: string; role?: string }): Chainable<string>;
    }
  }
}

Cypress.Commands.add('loginViaUI', (email: string, password: string) => {
  cy.visit('/admin');
  cy.get('input#email').clear().type(email);
  cy.get('input#senha').clear().type(password);
  cy.contains('button', 'Entrar').click();
  cy.url().should('include', '/admin/painel', { timeout: 10000 });
});

Cypress.Commands.add('seedAndLogin', (options = {}) => {
  const {
    email = 'test@cifras.dev',
    password = 'Senha@123',
    displayName = 'Test User',
    role = 'membro',
  } = options;

  return cy
    .task<string>('seedTestUser', { email, password, displayName, role })
    .then((uid) => {
      cy.loginViaUI(email, password);
      return cy.wrap(uid);
    });
});

export {};
