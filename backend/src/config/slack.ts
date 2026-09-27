import "dotenv/config";

const clientId = process.env.SLACK_CLIENT_ID;
const clientSecret = process.env.SLACK_CLIENT_SECRET;
const redirectUri = process.env.SLACK_CALLBACK_URL;

if (!clientId || !clientSecret || !redirectUri) {
  throw new Error(
    "Slack OAuth configuration is incomplete. Check SLACK_CLIENT_ID, SLACK_CLIENT_SECRET and SLACK_CALLBACK_URL."
  );
}

export const slackConfig = {
  clientId,
  clientSecret,
  redirectUri
};