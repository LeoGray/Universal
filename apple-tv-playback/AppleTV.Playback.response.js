// SPDX-License-Identifier: Apache-2.0
// Playback host aliases follow NSRingo/TV v3.4.4; see README.md for provenance.
// No requests, storage, account/region changes, or navigation reconstruction.
(() => {
  let result = {};
  try {
    const contentEndpoint = /^https:\/\/uts-api\.itunes\.apple\.com\/uts\/v3\/(?:canvases|shelves|movies|shows|episodes|sporting-events)(?:[/?]|$)/;
    if (
      $request.method === 'GET' && contentEndpoint.test($request.url) &&
      $response.status >= 200 && $response.status < 300 &&
      typeof $response.body === 'string'
    ) {
      const original = $response.body;
      // Validate first, but do not serialize the whole object: that would change
      // unrelated bytes and could round large numeric identifiers.
      JSON.parse(original);
      let expectedValueOffset = -1;
      const body = original.replace(/"(?:\\[\s\S]|[^"\\])*"/g, (literal, offset) => {
        const value = JSON.parse(literal);
        if (offset === expectedValueOffset) {
          expectedValueOffset = -1;
          const aliased = value.replace(
            /^(https?:\/\/)play(-edge)?\.itunes\.apple\.com(?=(?::\d+)?(?:[/?#]|$))/i,
            (_match, scheme, edge) => `${scheme.toLowerCase()}play${edge ? '-edge' : ''}-cdn.itunes.apple.com`,
          );
          return aliased === value ? literal : JSON.stringify(aliased);
        }
        expectedValueOffset = -1;
        if (value === 'hlsUrl') {
          const end = offset + literal.length;
          const separator = /^[\t\n\r ]*:[\t\n\r ]*/.exec(original.slice(end));
          if (separator) expectedValueOffset = end + separator[0].length;
        }
        return literal;
      });
      if (body !== original) result = { body };
    }
  } catch {
    // An unexpected response must continue unchanged, never break the TV app.
  }
  $done(result);
})();
