// Clean-up for browsers that installed an earlier cnviz.com as an app (it used an offline cache).
// cnviz.com is no longer installable. When such a browser next checks for an update, it gets this file,
// which deletes the old cache, removes itself and reloads open tabs, so they show the current demo-only site.
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key)
    await self.registration.unregister()
    for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url)
  })())
})
