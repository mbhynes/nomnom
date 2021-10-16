
function getUrls(el) {
  bgImg = el.style.backgroundImage;

  if (bgImg) {
    src = bgImg.replace(/^\s?url\((\"|\')/, '').replace(/(\"|\')\)\s?$/, '')
    bgImg = '';
  } else {
    src = el.src;
  }

  if (src.match(/^data\:image|\/\//)) {
    return src;
  }

  return document.location.origin.replace(/\/$/, '') + '/' + src;
}
