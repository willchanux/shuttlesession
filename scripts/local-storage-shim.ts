/**
 * The selection engines keep their state in localStorage. Outside a browser
 * there isn't one, so provide a stand-in. Import this before anything else in
 * a script, so it exists by the time the engines load.
 */
if (typeof localStorage === "undefined") {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  });
}

export {};
