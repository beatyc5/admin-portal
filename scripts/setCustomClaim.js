// Usage: node setCustomClaim.js <uid> <role>
// Example: node setCustomClaim.js abc123 field_team

const admin = require('firebase-admin');

if (process.argv.length !== 4) {
  console.log('Usage: node setCustomClaim.js <uid> <role>');
  process.exit(1);
}

const uid = process.argv[2];
const role = process.argv[3];

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

admin.auth().setCustomUserClaims(uid, { role })
  .then(() => {
    console.log(`Custom claim 'role: ${role}' set for user ${uid}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error setting custom claim:', error);
    process.exit(1);
  });
