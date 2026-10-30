export interface Config {
  port: number;
  mongoUrl: string;
  cookieSecure: boolean;
  allowRegistration: boolean;
}

const flag = (value: string | undefined, fallback: boolean) =>
  value === undefined || value === '' ? fallback : ['1', 'true', 'yes'].includes(value.toLowerCase());

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mongoUrl = env.MONGO_URL;
  if (!mongoUrl) throw new Error('MONGO_URL is required');
  return {
    port: Number(env.PORT ?? 4000),
    mongoUrl,
    cookieSecure: flag(env.COOKIE_SECURE, env.NODE_ENV === 'production'),
    allowRegistration: flag(env.ALLOW_REGISTRATION, true),
  };
}
