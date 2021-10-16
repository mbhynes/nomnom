function isImage(i) {
  return i instanceof HTMLImageElement;
}

function clickHandler(e) {
  console.log("Click!");
  var el = e.target.id;
  var html = e.target.innerHTML;
  console.log("Clicked on:" + e.target.src);
  if (isImage(e.target)) {
    fout = getFileName(e.target.src, 'test', '1');
    console.log("Click: Saving " + e.target.src + " to: " + fout);
    download(e.target.src, fout);
  }
};

// document.addEventListener("click", clickHandler);
// chrome.browserAction.onClicked.addListener(clickHandler);

// ugh none of this shit works
console.log("loading click.js");
window.addEventListener('load', function() {
  console.log("Adding handlers");
  var imgs = document.getElementsByTagName("img");
  console.log("Found " + imgs.lenth + " handlers");
  for (var i = 0; i < imgs.length; i++) {
    console.log("Adding handler to: " + imgs[i])
    imgs[i].addEventListener("click", clickHandler);
  }
});
