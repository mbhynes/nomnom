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
    for (const node of mutation.addedNodes) {
      try {
        var all_img = node.getElementsByTagName('img');
        if (all_img.length == 0) {
          continue;
        }
        try {
          // Set the pointer events of the added node to none so that the click is registered on the parent element
          // if the style if defined
          if (node.style) {
            node.style.pointerEvents = "none";
          } else {
            // initialize the style attribute of the node
            node.style = {pointerEvents: "none"};
          }
        } catch (err) {
          console.error("Error setting pointerEvents to none for added node: " + node);
        }
        try {
          var hrefs = node.getElementsByTagName('a');
          for (const tag of hrefs) {
            try {
            tag.style.pointerEvents = "auto";
            } catch (err) {
              console.error("Error setting pointerEvents to auto for added tag: " + tag);
            }
          }
        } catch (err) {
          console.error("Error in mutationCallback: " + err);
        }

        try {
          var all_img = node.getElementsByTagName('img');
          for (const img of all_img) {
            try {
              console.debug("Adding click listener to image: " + img.src)
              if (!img.style) {
                img.style = {};
              }
              // Set the border of the img element to blue
              img.style.padding = "none";
              img.style.border = "5px solid blue";
              // Set the pointer events of the image to none so that the click is registered on the parent element
              img.style.pointerEvents = "auto";

              // Set the image to turn blue on hover
              // img.style.hover = "5px solid blue";
              img.addEventListener("click", (e) => clickCallback(e), false);
            } catch (err) {
              console.error("Error adding callback to img: " + img.src);
            }
          }
        } catch (err) {
          console.error("Error in mutationCallback: " + err);
        }
      } catch (err) {
        console.error("Error could not get Elements by tag name for mutated element " + err + " on: " + node);
      }
    }
  }
};

/**
 * Handle a special right-click event on the image.
 */
function clickCallback(e) {
  if (e.shiftKey) {
    e.preventDefault();
    var img = e.target;
    img.style.border = "5px solid red";
    console.log("Right-clicked " + img.src);
    chrome.runtime.sendMessage({url: img.src}, function(response) {
      console.log("Got result:", response);
    });
    return false;
  } else {
    console.log("Right-clicked but shiftKey was up");
    return true;
  }
};
