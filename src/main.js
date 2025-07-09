import { Client, Users, Account, ID } from 'node-appwrite';
import { OAuth2Client } from 'google-auth-library';

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

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const name = payload?.name || 'Unknown';

    log({ payload, email, name });

    if (!email) {
      return res.json({ error: 'Email not found in Google token' }, 400);
    }

    const appwriteClient = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const users = new Users(appwriteClient);
    const account = new Account(appwriteClient);

    // Check if user already exists
    let user;
    try {
      user = await users.getUserByEmail(email);
    } catch {
      // Create user if not found
      user = await users.create(
        ID.unique(), // userId
        email,
        undefined,
        process.env.MAGIC_PASSWORD,
        name
      );
    }
    const MAGIC_PASSWORD =
      process.env.MAGIC_PASSWORD || 'google_oauth_password';

    const session = await account.createEmailPasswordSession(
      email,
      MAGIC_PASSWORD
    );
    log({
      success: true,
      sessionId: session.$id,
      userId: user.$id,
      jwt: session.jwt,
    });
    return res.json({
      success: true,
      sessionId: session.$id,
      userId: user.$id,
      jwt: session.jwt,
    });
  } catch (err) {
    return res.json({ error: err.message }, 500);
  }
};
