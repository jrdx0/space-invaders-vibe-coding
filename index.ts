const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Serve index.html
    if (url.pathname === "/") {
      return new Response(Bun.file("public/index.html"));
    }

    // Serve game.js (bundled on the fly)
    if (url.pathname === "/game.js") {
      const build = await Bun.build({
        entrypoints: ["client/game.ts"],
        minify: false,
      });
      return new Response(build.outputs[0]);
    }

    // Serve assets
    if (url.pathname.startsWith("/assets/")) {
      const assetPath = `client${url.pathname}`;
      const file = Bun.file(assetPath);
      if (await file.exists()) {
        return new Response(file);
      }
    }

    return new Response("404!", { status: 404 });
  },
});

console.log(`Listening on http://localhost:${server.port}`);