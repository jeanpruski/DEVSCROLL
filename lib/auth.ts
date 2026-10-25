import { betterAuth } from 'better-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { pool } from './db';
import type { AppUser } from './contracts';
import { validateConfig } from './config';

const config = validateConfig();

export const auth = betterAuth({
  database: pool,
  baseURL: config.BETTER_AUTH_URL,
  secret: config.BETTER_AUTH_SECRET,
  trustedOrigins: [new URL(config.BETTER_AUTH_URL).origin],
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
  user: { additionalFields: { role: { type: 'string', defaultValue: 'reader', input: false } } },
  session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: { '/sign-in/email': { window: 60, max: 10 } },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
  },
});
export async function getUser(requestHeaders?: Headers): Promise<AppUser | null> {
  const session = await auth.api.getSession({ headers: requestHeaders ?? (await headers()) });
  if (!session) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role ?? 'reader',
  };
}
export const getSessionUser = getUser;
export async function requireUser(): Promise<AppUser> {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}
export async function requireOwner(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== 'owner') redirect('/feed');
  return user;
}
