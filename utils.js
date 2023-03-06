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
