import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
);

export {
    googleClient,
}