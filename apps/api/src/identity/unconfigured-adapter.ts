import { InvalidAuthenticationError, type AuthenticationAdapter } from "./auth.js";

export const unconfiguredAuthenticationAdapter: AuthenticationAdapter = {
  async verifyCredential(_credential: string) {
    throw new InvalidAuthenticationError("AUTH_PROVIDER_NOT_CONFIGURED");
  }
};
