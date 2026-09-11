export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // The public root is the customer storefront. Keep the browser URL clean
    // while serving the existing storefront index from its directory.
    if (url.pathname === "/") {
      const storefrontUrl = new URL(request.url);
      storefrontUrl.pathname = "/storefront/index.html";
      return env.ASSETS.fetch(new Request(storefrontUrl, request));
    }

    return env.ASSETS.fetch(request);
  },
};
