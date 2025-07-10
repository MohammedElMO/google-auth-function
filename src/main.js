import { Client, Users, Account, ID, OAuthProvider } from 'node-appwrite';
import { JWT, OAuth2Client } from 'google-auth-library';

// This Appwrite function will be executed every time your function is triggered
export default async ({ req, res, log, error }) => {
  // You can use the Appwrite SDK to interact with other services
  // For this example, we're using the Users service
  try {
    const { idToken } = JSON.parse(req.body);
    const googleClientId = process.env.GOOGLE_CLIENT_ID;

    if (!idToken || !googleClientId) {
      return res.json({ error: 'Missing idToken or client ID' }, 400);
    }

    const googleClient = new OAuth2Client(googleClientId);

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error('Google token invalid:', err);
      return res.status(401).send({ error: 'Invalid Google ID token' });
    }


    const appwriteClient = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const account = new Account(appwriteClient);

    try {
      const session = await account.createOAuth2Session(
        OAuthProvider.Google,
        process.env.SUCCESS_URL,
        process.env.FAILED_URL,
        (session = {}) // No extra scopes
      );
      return res.send({
        sessionId: session.$id,
        userId: session.userId,
        providerUid: session.providerUid,
        emailVerified: session.emailVerification === true,
      });
    } catch (err) {
      console.error('Appwrite session error:', err);
      return res.status(500).send({
        error: 'Failed to create Appwrite session',
        message: err.message,
      });
    }
  } catch (e) {
    return res.status(500).send({
      error: `Failed To exec Function ${e}`,
      message: err.message,
    });
  }
};
