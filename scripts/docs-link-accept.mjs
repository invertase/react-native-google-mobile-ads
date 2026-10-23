const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  if (headers.get('user-agent') === 'docs.page-cli' && !headers.has('accept')) {
    headers.set('accept', 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8');
  }
  return originalFetch(input, { ...init, headers });
};
