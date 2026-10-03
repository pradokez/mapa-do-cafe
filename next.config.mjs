/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // #38: o Borsoi do RioMar ganhou slug próprio; links antigos continuam valendo.
      { source: "/cafes/borsoi-cafe", destination: "/cafes/borsoi-cafe-riomar", permanent: true },
    ];
  },
};

export default nextConfig;
