chrome.webRequest.onCompleted.addListener(contentHandler, {urls: [ "<all_urls>" ], types: ['image']}, []);

// Select the node that will be observed for mutations
// const targetNode = document.body;
//
// // Options for the observer (which mutations to observe)
// const config = { attributes: true, childList: true, subtree: true };
//
// // Callback function to execute when mutations are observed
// const callback = function(mutationsList, observer) {
//     // Use traditional 'for loops' for IE 11
//     for(const mutation of mutationsList) {
//         if (mutation.type === 'childList') {
//             console.log('A child node has been added or removed.');
//         }
//         else if (mutation.type === 'attributes') {
//             console.log('The ' + mutation.attributeName + ' attribute was modified.');
//         }
//     }
// };
//
// // Create an observer instance linked to the callback function
// const observer = new MutationObserver(callback);
//
// // Start observing the target node for configured mutations
// observer.observe(targetNode, config);

// document.addEventListener("DOMNodeInserted", function(e) {
//   console.log("domnodeinserted");
//   // insertedNodes.push(e.target);
// }, false);
// chrome.webNavigation.onDOMContentLoaded.addListener(function () {
//   console.log('domcontentloaded');
//   var elems = document.body.getElementsByTagName("*");
//   console.log(elems.length);
// });
// chrome.webNavigation.onBeforeNavigate.addListener(function () {
//   console.log("Click!");
// });

function contentHandler(details){
  fout = getFileName(details.url, 'test', '0');
  console.log("Saving " + details.url + " to: " + fout);
  // console.log(document.images);
  // var search_string = "img[src*='" + details.url + "']";
  // var element = document.querySelector(search_string);
  // console.log(search_string);
  // console.log(element);
  // saveAs(details.url, fout);
  // download(details.url, fout);
}

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
