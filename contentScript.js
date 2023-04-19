var url_rules = ["<all_urls>"];

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

function isUrlAllowListed(url) {
  if (url_rules.length == 0) {
    return true;
  }
  if (url_rules[0] == "<all_urls>") {
    return true;
  }
  for (rule of url_rules) {
    if ((rule == "<all_urls>") || (url.match(rule.replace('*', '.*')))) {
      return true;
    }
  }
  return false;
}

function processImage(img) {
  // skip images that are not in the rules allowlist, but 
  // don't mark them visited; if the allow list changes and
  // a DOM mutation occurs, we want to re-visit the image
  if (!isUrlAllowListed(img.src)) {
    console.log(`Image ${img.src} not in the current rules list: ${url_rules}"`)
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
        var all_img = node.getElementsByTagName('img');
        if (all_img.length == 0) {
          continue;
        }
        // Patch all new image elements in the DOM such that:
        // - The image has a notable border
        // - Clicks on child elements overlaying the image are registerd on the image
        // - The extension click callback is registered on the image
        for (const img of all_img) {
          processImage(img);
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
    console.log("img.dataset:", img.dataset);
    if (img.dataset.__clicked == "true") {
      // Register a click to revert click; the "unclick"
      img.dataset.__clicked = false;
      img.style.border = "5px solid blue";
      console.log("again Right-clicked " + img.src);
      chrome.runtime.sendMessage({
        "type": "image_click",
        "value": {"url": img.src, "count": -1, "timestamp": Date.now(), "initiator": location.href}
      })
    } else {
      img.dataset.__clicked = true;
      img.style.border = "5px solid red";
      console.log("Right-clicked " + img.src);
      chrome.runtime.sendMessage({
        "type": "image_click",
        "value": {"url": img.src, "count": 1, "timestamp": Date.now(), "initiator": location.href}
      })
    }

  } else {
    console.log("Right-clicked but shiftKey was up");
    return true;
  }
};


// Request the current url_rules
chrome.runtime.sendMessage({"type": "get_url_rules"}, function(response) {
  if (response.url_rules) {
    url_rules = response.url_rules;
  }
});

async function getDirectoryHandle() {
  const opts = {
    type: 'open-directory'
  };
  console.log("opening picker")
  return await window.showDirectoryPicker(opts);
}

// Listen for updates to the url rules
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log(request);
    if (request.type == "url_rules_update") {
      if (request.value.url_rules) {
        url_rules = request.value.url_rules;
      }
    } else if (request.type == "action:export_db") {
      console.log("Received message", request);
      getDirectoryHandle();
    };
  }
);

// Process the initial set of images in the DOM
var all_img = document.getElementsByTagName('img');
for (const img of all_img) {
  processImage(img);
}
