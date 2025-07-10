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
      return res.json({ error: 'Invalid Google ID token' });
    }

    const appwriteClient = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    // const account = new Account(appwriteClient);

    try {
      const response = await fetch(
        `${process.env.APPWRITE_FUNCTION_API_ENDPOINT}/account/sessions/oauth2/google`,
        {
          method: 'POST',
          headers: {
            'X-Appwrite-Project': process.env.APPWRITE_FUNCTION_PROJECT_ID,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        }
      );

      const session = await response.json();
      if (!response.ok) {
        console.error('Appwrite OAuth2 error:', session);
        return res.json({
          error: 'Failed to create session',
          details: session,
        });
      }
	  
      log({
        sessionId: session.$id,
        userId: session.userId,
        providerUid: session.providerUid,
        emailVerified: session.emailVerification === true,
      });
      return res.json({
        sessionId: session.$id,
        userId: session.userId,
        providerUid: session.providerUid,
        emailVerified: session.emailVerification === true,
      });
    } catch (err) {
      console.error('Appwrite session error:', err);
      return res.json({
        error: 'Failed to create Appwrite session',
        message: err.message,
      });
    }
  } catch (e) {
    return res.json({
      error: `Failed To exec Function ${e}`,
      message: err.message,
    });
  }
};
