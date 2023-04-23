/**
 * Nomnom - Content Script
 *
 * This script is injected into every page loaded by the browser, and is responsible
 * for the following:.
 * - Detecting when images are added to the DOM through a MutationObserver
 * - Modifying the CSS of images to display the clicked/un-clicked status
 * - Attaching on-click callbacks to each image, to send any click events
 *   to the background script that stores the click data.
 */

const clickedImageBorder = "5px solid red";
const unlickedImageBorder = "5px solid blue";

// Set the default rules to a blanket "*" allow list
// The url rules must be a list of Match Pattern strings as per:
//  https://developer.chrome.com/docs/extensions/mv2/match_patterns
var urlRules = ["<all_urls>"];

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
 * Return true if the URL is valid according to the current urlRules.
 */
function isUrlAllowListed(url) {
  if (urlRules.length == 0) {
    return true;
  }
  if (urlRules[0] == "<all_urls>") {
    return true;
  }
  for (rule of urlRules) {
    if ((rule == "<all_urls>") || (url.match(rule.replace('*', '.*')))) {
      return true;
    }
  }
  return false;
}

/**
 * Process a single image element in the DOM, adding click callbacks and styling.
 */
function processImage(img) {
  // skip images that are not in the rules allowlist, but 
  // don't mark them visited; if the allow list changes and
  // a DOM mutation occurs, we want to re-visit the image
  if (!isUrlAllowListed(img.src)) {
    console.log(`Image ${img.src} not in the current rules list: ${urlRules}"`)
    return;
  }
  // Check if the image has already been visited
  if (img.dataset.__visited) {
    console.log("Image already visited: " + img.src);
    return;
  } else {
    img.dataset.__visited = true;
    img.dataset.__clicked = false;
  }

  try {
    // iterate over all children of the img element and set the pointer events to none
    for (const child of img.children) {
      if (child.style) {
        child.style.pointerEvents = "none";
      } else {
        child.style = {pointerEvents: "none"};
      }
    }
  } catch(err) {
    console.error("Could not set pointerEvents to none for children of img: " + img.src);
  };

  // Set the style of the img element to have a blue border
  try {
    console.debug("Adding click listener to image: " + img.src)
    if (!img.style) {
      img.style = {};
    }
    // Set the border of the img element to blue
    img.style.padding = "none";
    img.style.border = unlickedImageBorder;

    // Set the pointer events of the image to none so that the click is registered on the parent element
    img.style.pointerEvents = "auto";

    img.addEventListener("click", (e) => clickCallback(e), false);
  } catch (err) {
    console.error(`Error adding callback to img: ${img.src}:`, err);
  }
}

/**
 * Detect images added to the DOM and add click callbacks to them.
 */
function mutationCallback(mutations) {
  // fired when a mutation occurs
  var mutation, i, len;
  for (i = 0, len = mutations.length; i < len; i++) {
    mutation = mutations[i];
    for (const node of mutation.addedNodes) {
      if (node.nodeType != Node.ELEMENT_NODE) {
        continue;
      }
      try {
        var images = node.getElementsByTagName('img');
        if (images.length == 0) {
          continue;
        }
        // Patch all new image elements in the DOM such that:
        // - The image has a notable border
        // - Clicks on child elements overlaying the image are registerd on the image
        // - The extension click callback is registered on the image
        for (const img of images) {
          processImage(img);
        }
      } catch (err) {
        console.error("Error could not get Elements by tag name for mutated element " + err + " on: " + node);
      }
    }
  }
};

/**
 * Handle a special click event on the image;
 * - If the shift key is down, prevent the default URL follow action
 * - Instead, send a message to the background script for the image's source URL,
 *   registering the a click event for that image URL for the current caption.
 */
function clickCallback(e) {
  if (e.shiftKey) {
    e.preventDefault();
    var img = e.target;
    console.debug(`Processing a shiftdown+click for ${img.src}`);
    if (img.dataset.__clicked == "true") {
      // Register a reverted click; i.e. an "unclick"
      img.dataset.__clicked = false;
      img.style.border = unlickedImageBorder
      chrome.runtime.sendMessage({
        "type": "event:image_click",
        "value": {"url": img.src, "count": -1, "timestamp": Date.now(), "initiator": location.href}
      })
    } else {
      img.dataset.__clicked = true;
      img.style.border = clickedImageBorder;
      chrome.runtime.sendMessage({
        "type": "event:image_click",
        "value": {"url": img.src, "count": 1, "timestamp": Date.now(), "initiator": location.href}
      })
    }
  }
};

// Listen for updates to the url rules
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log(request);
    if (request.type == "urlRules_update") {
      if (request.value.urlRules) {
        urlRules = request.value.urlRules;
      }
    }
  }
);

// Request the current urlRules on page load
chrome.runtime.sendMessage({"type": "get:urlRules", "value": {}}, function(response) {
  if (response.urlRules) {
    urlRules = response.urlRules;
  }
});

// Process the initial set of images in the DOM
var images = document.getElementsByTagName('img');
for (const img of images) {
  processImage(img);
}
