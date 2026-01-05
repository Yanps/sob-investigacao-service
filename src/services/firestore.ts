import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.GCP_PROJECT
    });
}

export const db = admin.firestore();
