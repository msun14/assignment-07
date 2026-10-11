const errors = [];
const warnings = [];
const env = process.env;
if (!env.DATABASE_URL || !/^postgres(ql)?:\/\//.test(env.DATABASE_URL) || /USER:PASSWORD@HOST/.test(env.DATABASE_URL)) errors.push("Set DATABASE_URL to a real persistent PostgreSQL connection URL.");
if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32 || env.BETTER_AUTH_SECRET.startsWith("replace-with")) errors.push("Generate and set BETTER_AUTH_SECRET (at least 32 random characters).");
try {
  const url = new URL(env.BETTER_AUTH_URL || "");
  if (url.pathname !== "/" || url.search || url.hash) errors.push("BETTER_AUTH_URL must be an origin only (no path/query/hash).");
  if (!["http:", "https:"].includes(url.protocol)) errors.push("BETTER_AUTH_URL must use HTTP or HTTPS.");
  if (env.NETLIFY && (url.protocol !== "https:" || url.hostname === "localhost")) errors.push("Set BETTER_AUTH_URL to your exact HTTPS Netlify/custom domain.");
} catch { errors.push("Set BETTER_AUTH_URL (http://localhost:3000 locally, HTTPS site origin on Netlify)."); }
for (const provider of ["GOOGLE", "GITHUB"]) {
  const complete = Boolean(env[`${provider}_CLIENT_ID`] && env[`${provider}_CLIENT_SECRET`]);
  const partial = Boolean(env[`${provider}_CLIENT_ID`]) !== Boolean(env[`${provider}_CLIENT_SECRET`]);
  if (partial || (!complete && env.REQUIRE_SOCIAL_AUTH === "true")) errors.push(`Set both ${provider}_CLIENT_ID and ${provider}_CLIENT_SECRET.`);
  else if (!complete) warnings.push(`${provider} sign-in will be unavailable until both credentials are configured.`);
}
warnings.forEach((message) => console.warn(`WARNING: ${message}`));
if (errors.length) { errors.forEach((message) => console.error(`ERROR: ${message}`)); process.exit(1); }
console.log("Environment configuration passed (credential values are not displayed).");
