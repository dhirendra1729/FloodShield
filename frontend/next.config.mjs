/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                encoding: false,
            };
        }
        return config;
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                // 127.0.0.1 rather than localhost. On this machine `localhost`
                // resolves to ::1 only, while uvicorn binds IPv4 0.0.0.0; Node
                // then falls back to IPv4 after a failed IPv6 connect, so every
                // proxied call pays a refused connection first. Addressing the
                // backend directly removes that step and the flakiness that
                // comes with it.
                destination: 'http://127.0.0.1:8000/api/:path*'
            }
        ]
    }
};

export default nextConfig;
