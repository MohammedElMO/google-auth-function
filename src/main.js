import { Client, Users, Account, ID, OAuthProvider } from 'node-appwrite';
import { JWT, OAuth2Client } from 'google-auth-library';

// This Appwrite function will be executed every time your function is triggered
export default async ({ req, res, log, error }) => {
  // You can use the Appwrite SDK to interact with other services
  // For this example, we're using the Users service
  //   res.setHeader('Content-Type', 'application/json');

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
      return res.json({ error: 'Invalid Google ID token' });
    }

    const email = payload.email;
    const name = payload.name || '';
    const googleUid = payload.sub;

    const appwriteClient = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const users = new Users(appwriteClient);
    let appwriteUser;
    try {
      // If you use Google UID as the Appwrite User ID (optional)
      appwriteUser = await users.get(googleUid);
    } catch {
      // User not found – create new user
      try {
        appwriteUser = await users.create(
          googleUid,
          email,
          null, // No password for OAuth
          null,
          name
        );
      } catch (createErr) {
        console.error('Failed to create Appwrite user:', createErr);
        return res.json({
          error: 'User creation failed',
          detail: createErr.message,
        });
      }
    }

    log({
      sessionId: appwriteUser.$id,
      email: appwriteUser.userId,
      name: appwriteUser.name,
      status: 'verified',
    });

    return res.json({
      userId: appwriteUser.$id,
      email: appwriteUser.email,
      name: appwriteUser.name,
      status: 'verified',
    });
  } catch (e) {
    return res.json({
      error: `Failed To exec Function ${e}`,
      message: err.message,
    });
  }
};
