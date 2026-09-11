export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Canonical public storefront URL is the site root. Legacy/internal
    // storefront HTML paths are redirected so relative links cannot leave
    // users stranded under /storefront/.
    if (url.pathname === "/storefront/" || url.pathname === "/storefront/index.html") {
      const canonical = new URL(request.url);
      canonical.pathname = "/";
      return Response.redirect(canonical, 301);
    }

    if (url.pathname.startsWith("/storefront/") && url.pathname.endsWith(".html")) {
      const filename = url.pathname.slice("/storefront/".length);
      const canonical = new URL(request.url);
      canonical.pathname = `/${filename}`;
      return Response.redirect(canonical, 301);
    }

    // Public root serves the customer storefront index without changing the URL.
    if (url.pathname === "/") {
      const storefrontUrl = new URL(request.url);
      storefrontUrl.pathname = "/storefront/index.html";
      return env.ASSETS.fetch(new Request(storefrontUrl, request));
    }

    // Public customer HTML pages are stored under /storefront but exposed at root.
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
