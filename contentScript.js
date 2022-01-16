// Add callbacks to all images in the DOM at first load.
var all_img = document.getElementsByTagName('img');
for (const img of all_img) {
  console.debug("Adding click listener to image: " + img.src)
  img.addEventListener("contextmenu", (e) => clickCallback(img.src, e), false);
}

// Add callbacks to all DOM mutation events, such that we may find images
// and add click callbacks once a mutation event is registered.
MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
var observer = new MutationObserver(mutationCallback);
observer.observe(document, {
  subtree: true,
  attributes: true,
  childList: true,
  subtree: true
});

/**
 * Detect images added to the DOM and add click callbacks to them.
 */
function mutationCallback(mutations) {
  // fired when a mutation occurs
  var mutation, i, len;
  for (i = 0, len = mutations.length; i < len; i++) {
    mutation = mutations[i];
    for (const added_node of mutation.addedNodes) {
      var all_img = added_node.getElementsByTagName('img');
      for (const img of all_img) {
        console.debug("Adding click listener to image: " + img.src)
        img.addEventListener("contextmenu", (e) => clickCallback(img.src, e), false);
      }
    }
  }
};

/**
 * Handle a special right-click event on the image.
 */
function clickCallback(src, e) {
  if (e.shiftKey) {
    console.log("Right-clicked " + src);
    e.preventDefault();
    chrome.runtime.sendMessage({url: src}, function(response) {
      console.log("Got result:", response);
    });
    return false;
  } else {
    console.log("Right-clicked but shiftKey was up");
    return true;
  }
};
