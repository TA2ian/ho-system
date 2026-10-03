export type Session = {
  token: string;
};

let session: Session | null = null;

export function getSession(): Session | null {
  return session;
}

export function setSession(token: string): Session {
  session = { token };
  return session;
}

export function clearSession(): void {
  session = null;
}
