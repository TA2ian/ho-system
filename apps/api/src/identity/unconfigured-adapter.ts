import type { AuthenticationAdapter } from "./auth.js";

export const unconfiguredAuthenticationAdapter: AuthenticationAdapter = {
  async verifyCredential(_credential: string) {
    throw new Error("AUTH_PROVIDER_NOT_CONFIGURED");
  }
};
