import { defineConfig } from 'cypress';
import * as admin from 'firebase-admin';

const PROJECT_ID = 'demo-cifras';

let adminApp: admin.app.App | null = null;

function getAdminApp(): admin.app.App {
  if (adminApp) return adminApp;
  process.env['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080';
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
  adminApp = admin.initializeApp({ projectId: PROJECT_ID }, 'cypress-admin');
  return adminApp;
}

const COLLECTIONS = ['cifras', 'cifras_indice', 'cifras_pr', 'listas', 'users', 'grupos', 'convites'];

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,

    setupNodeEvents(on) {
      on('task', {
        async clearEmulatorData() {
          const a = getAdminApp();
          const db = a.firestore();
          const auth = a.auth();

          await Promise.all(
            COLLECTIONS.map(async (col) => {
              const snap = await db.collection(col).get();
              const batch = db.batch();
              snap.docs.forEach((d) => batch.delete(d.ref));
              await batch.commit();
            }),
          );

          const users = await auth.listUsers();
          await Promise.all(users.users.map((u) => auth.deleteUser(u.uid)));
          return null;
        },

        async seedTestUser({ email, password, displayName, role = 'membro' }: {
          email: string;
          password: string;
          displayName: string;
          role?: string;
        }) {
          const a = getAdminApp();
          const user = await a.auth().createUser({ email, password, displayName });
          await a.firestore().doc(`users/${user.uid}`).set({
            uid: user.uid,
            email,
            displayName,
            role,
            grupoIds: [],
            criadoEm: new Date().toISOString(),
            ultimoLogin: new Date().toISOString(),
          });
          return user.uid;
        },

        async seedDocument({ collection, data }: { collection: string; data: Record<string, unknown> }) {
          const ref = await getAdminApp().firestore().collection(collection).add(data);
          return ref.id;
        },

        async setDocument({ collection, id, data }: { collection: string; id: string; data: Record<string, unknown> }) {
          await getAdminApp().firestore().collection(collection).doc(id).set(data);
          return id;
        },

        async getFirestoreDoc({ collection, id }: { collection: string; id: string }) {
          const doc = await getAdminApp().firestore().collection(collection).doc(id).get();
          return doc.exists ? { id: doc.id, ...doc.data() } : null;
        },

        async queryCollection({ collection: col, field, value }: { collection: string; field: string; value: unknown }) {
          const snap = await getAdminApp().firestore().collection(col).where(field, '==', value).get();
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        },
      });
    },
  },
});
