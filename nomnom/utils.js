/**
 * Convert a source URL string into a key for the indexedDB storge object. 
 *
 * This function returns a simplified searchParam-free URL of src, and handles
 * the more complicated image urls in the page results for common image search
 * engines (google, bing, duckduckgo) as special cases. 
 */
function keyFromUrl(src) {
  try {
    const url = new URL(src);
    switch (url.hostname) {
      case "encrypted-tbn0.gstatic.com":
        return url.hostname + url.pathname + '&q=' + url.searchParams.get('q');
      case "external-content.duckduckgo.com":
        return url.searchParams.get('u');
      default:
        return url.hostname + url.pathname;
    }
  } catch (error) {
    console.error("Failed to parse url: " + src, error);
  }
}

function imageTypeFromUrl(src) {
  try {
    const url = new URL(src);
    var filename = '';
    switch (url.hostname) {
      case "encrypted-tbn0.gstatic.com":
        filename = url.searchParams.get('q');
      case "external-content.duckduckgo.com":
        filename = url.searchParams.get('u');
      default:
        filename = url.pathname;
    }
    return filename.split('.').pop()
  } catch (error) {
    console.error("Failed to parse url: " + src, error);
    return ''
  }
}

function cyrb53hash(str, seed = 0) {
  // https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};
