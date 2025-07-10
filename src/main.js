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

    const email = payload?.email;
    const name = payload?.name || '';
    const googleUserId = payload?.sub;

    const appwriteClient = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const users = new Users(appwriteClient);

    let appwriteUserId;

    // 2. Find or create user in Appwrite
    try {
      // Try to get user by ID (using Google User ID as Appwrite User ID)
      const appwriteUser = await users.get(googleUserId);
      appwriteUserId = appwriteUser.$id;
    } catch (error) {
      if (error.code === 404) {
        // User not found, create new
        console.log('Appwrite user not found, creating new...');

        const newUser = await users.create(
          googleUserId, // Use Google User ID as Appwrite User ID
          email,
          null, // No password needed for custom token auth
          name
        );
        appwriteUserId = newUser.$id;
      } else {
        throw error; // Re-throw other errors
      }
    }

    // 3. Generate Appwrite custom token
    const token = await users.createToken(appwriteUserId);

    // 4. Send token secret back to Android app
    res.json({
      success: true,
      appwriteUserId: appwriteUserId,
      tokenSecret: token.secret,
    });
  } catch (e) {
    return res.json({
      error: `Failed To exec Function ${e}`,
      message: e.message,
    });
  }
};
