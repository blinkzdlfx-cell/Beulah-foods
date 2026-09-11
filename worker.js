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

    // Serve customer HTML pages from /storefront while keeping clean public
    // URLs such as /login.html and /account.html. Admin routes are untouched.
    if (
      url.pathname.endsWith(".html") &&
      !url.pathname.startsWith("/storefront/") &&
      !url.pathname.startsWith("/admin/")
    ) {
      const storefrontUrl = new URL(request.url);
      storefrontUrl.pathname = `/storefront${url.pathname}`;
      return env.ASSETS.fetch(new Request(storefrontUrl, request));
    }

    return env.ASSETS.fetch(request);
  },
};
