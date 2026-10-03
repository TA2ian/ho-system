import { InvalidAuthenticationError, type AuthenticationAdapter } from "./auth.js";

export const unconfiguredAuthenticationAdapter: AuthenticationAdapter = {
  async verifyCredential(_credential: string) {
    throw new InvalidAuthenticationError("AUTH_PROVIDER_NOT_CONFIGURED");
  }
};

export function assertProductionAuthenticationConfigured(
  nodeEnv: string,
  adapter: AuthenticationAdapter
): void {
  if (nodeEnv === "production" && adapter === unconfiguredAuthenticationAdapter) {
    throw new Error("AUTH_PROVIDER_NOT_CONFIGURED");
  }
}
