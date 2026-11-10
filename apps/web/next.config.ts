import type { NextConfig } from "next";
const config: NextConfig = {
  // Auth callbacks carry short-lived authorization codes in their query string.
  logging: { incomingRequests: { ignore: [/\/auth\/callback/] } },
};
export default config;
