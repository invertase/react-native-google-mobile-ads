const NOT_IMPLEMENTED_MESSAGE =
  'The react-native-google-mobile-ads Next-Gen Android backend is not implemented yet.';

describe('Next-Gen Android backend placeholder', () => {
  it('fails fast with the intentional not-implemented error', async () => {
    await browser.waitUntil(
      async () => (await browser.getPageSource()).includes(NOT_IMPLEMENTED_MESSAGE),
      {
        timeout: 30000,
        timeoutMsg: `Expected the app to display: ${NOT_IMPLEMENTED_MESSAGE}`,
      },
    );
    expect(await browser.getPageSource()).toContain(NOT_IMPLEMENTED_MESSAGE);
  });
});
