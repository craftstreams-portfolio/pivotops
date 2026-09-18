function required(
  value: string | undefined,
  key: string
) {
  if (!value) {
    throw new Error(
      `Missing environment variable: ${key}`
    );
  }

  return value;
}

export const ENV = {
  SUPABASE_URL: required(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL"
  ),

  SUPABASE_ANON_KEY: required(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  ),

  REDIS_URL: required(
    process.env.REDIS_URL,
    "REDIS_URL"
  ),
};