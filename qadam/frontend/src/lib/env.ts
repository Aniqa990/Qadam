// Only public, VITE_-prefixed values belong here. Never add secrets.
export const clientEnv = {
  clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string,
};

if (!clientEnv.clerkPublishableKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "VITE_CLERK_PUBLISHABLE_KEY is not set - Clerk auth will not initialize. Check frontend/.env"
  );
}
