import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /*
     * Photo uploads go through a server action, and the default cap is 1MB —
     * less than a single phone photo.
     *
     * 4mb, not more: Vercel caps a serverless function's request body at 4.5MB,
     * so a larger limit here would work locally and fail in production with a
     * 413. Phone photos often exceed this — the fix is to upload straight from
     * the browser to Cloudinary with a signed request, which never touches a
     * function body. Not built yet.
     */
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
