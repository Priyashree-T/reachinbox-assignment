import { OAuth2Client } from "google-auth-library";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_CALLBACK_URL;

if (!clientId || !clientSecret || !redirectUri) {
  throw new Error(
    "Google OAuth configuration is incomplete. Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL."
  );
}

export const googleOAuthClient = new OAuth2Client(
  clientId,
  clientSecret,
  redirectUri
);