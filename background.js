const IMAGE_POST_ENDPOINT = "image/";

const DATASTORE_KEYS = {
  "images": "url",
  "captions": "key",
}

var should_collect_unclicked = false;
var should_remote_post = false;
var hostname = "";
var caption = "";
var caption_key = cyrb53hash("");

// Instantiate an indexedDB for the extension to store accumulating image click facts.
var db;
var request = window.indexedDB.open('imgdb', 1);
request.onerror = function(event) {
  console.error("indexedDB could not be opened in the extension..");
};
request.onsuccess = function(event) {
  db = event.target.result;
  console.debug("Opened database:", db);
};
request.onerror = function(event) {
  console.error("Failed to open database")
};
request.onupgradeneeded = function(event) {
  var db = event.target.result;
  if (!db.objectStoreNames.contains('images')) {
    var obj = db.createObjectStore('images', {keyPath: 'url'});
    obj.createIndex(DATASTORE_KEYS['images'], DATASTORE_KEYS['images'], {unique: true});
  }
  if (!db.objectStoreNames.contains('captions')) {
    var obj = db.createObjectStore('captions', {keyPath: 'key'});
    // create an index on the string key
    obj.createIndex(DATASTORE_KEYS['images'], DATASTORE_KEYS['images'], {unique: true});
  }
};

// Add callbacks on all downloaded images during the session
chrome.webRequest.onCompleted.addListener(contentHandler, {
  urls: [ "<all_urls>" ],
  types: ['image']
}, []);

function pathJoin(base, path) {
  return [base, path].join('/').replace(/\/+/g, '/');
}

function mergeImagePayloads(prev, current) {
  var updates = {
    view_events: prev.view_events.concat(current.view_events),
    click_events: prev.click_events.concat(current.click_events),
  }
  return {
    ...prev,
    ...updates
  }
}

function upsert(database, payload, onSuccess, onError, mergeFn) {
  const obj = db.transaction([database], "readwrite").objectStore(database);
  const key = payload[DATASTORE_KEYS[database]];
  const getRequest = obj.get(key);
  getRequest.onerror = function(event) {
    console.log("Error getting record:", event.target.errorCode);
  };
  getRequest.onsuccess = function(event) {
    const result = event.target.result;
    if (result === undefined) {
      var request = obj.add(payload);
      if (onError !== undefined)
        request.onerror = onError;
      if (onSuccess !== undefined)
        request.onsuccess = onSuccess;
    } else {  
      console.log("get result:", result, event)
      var record;
      if (mergeFn === undefined) {
        record = {...result, ...payload};
      } else {
        record = mergeFn(result, payload);
      }
      console.debug("Updating record to be:", record);
      var updateRequest = obj.put(record);
      if (onError !== undefined)
        updateRequest.onerror = onError;
      if (onSuccess !== undefined)
        updateRequest.onsuccess = onSuccess;
    }
  };
}

/**
 * Save downloaded images to the indexedDB with the following schema:
 * {
 *   url (string):                the formatted key version of the image url, from utils.keyFromUrl
 *   initiator (string):          referring site from which the request was placed
 *   requested_at (numeric):      epoch-millisecond timestamp of the request
 *   image (bytes):               the actual stored image
 *   is_clicked (boolean):        true if this image has been clicked
 *   first_clicked_at (numeric):  epoch-millisecond timestamp of the first click event
 * }
 */
function storeImageEventPayload(url, payload) {
  // Create a cross-header request to GET the image
  // This will typically not actually result in a request,
  // however since the image will be retrieved from cache.
  const key = keyFromUrl(url);
  var xhr = new XMLHttpRequest(),
      blob;
  xhr.open("GET", url, true);
  xhr.responseType = "blob";

  xhr.addEventListener("load", function () {
    if (xhr.status === 200) {
      blob = xhr.response;
      let record = {
        ...payload,
        ...{"image": blob}
      };
      console.log("Attempting to save record:", record);
      upsert('images', record, console.debug, console.debug, mergeImagePayloads);
    } else {
      console.error("Failed to retrieve image:", url);
    }
  }, false);

  if (should_remote_post) {
    xhr.addEventListener("load", function () {
      if (xhr.status === 200) {
        blob = xhr.response;
        console.log("Posting payload:", payload);
        chrome.storage.local.get(["token"], function (result) {
          var log_xhr = new XMLHttpRequest();
          var payload_form = new FormData();
          for (const key in payload) {
            payload_form.set(key, payload[key]);
          }
          payload_form.append(
            'img',
            xhr.response,
            // new Blob([xhr.response], {"type": imageTypeFromUrl(details.url)}),
            // details.url
            "file." + imageTypeFromUrl(url)
          );

          endpoint = pathJoin(hostname, IMAGE_POST_ENDPOINT)
          log_xhr.open("POST", endpoint, true);
          log_xhr.responseType = 'json';
          log_xhr.setRequestHeader('Authorization', 'Token ' + result.token);
          console.debug("Posting payload with token:", result.token);
          console.debug("Blob:", blob);
          log_xhr.addEventListener("load", function () {
            if (log_xhr.status === 200) {
              console.debug("Successful POST to: ", endpoint, log_xhr.status, log_xhr.response);
            } else {
              console.error("Encountered error on POST to ", endpoint, log_xhr.status, log_xhr.response);
            }
          })
          log_xhr.send(payload_form);
        });
      }
    }, false);
    xhr.send();
  }
};

function contentHandler(details) {
  const payload = {
    url: details.url,
    initiator: details.initiator,
    requested_at: details.timeStamp,
    view_events: [{
      "timetamp": details.timeStamp,
      "caption_key": caption_key,
      "count": 1,
    }],
    click_events: [],
  }
  storeImageEventPayload(details.url, payload);
}

function imageClickHandler(request, sender, sendResponse) {
  const payload = {
    url: request.url,
    view_events: [],
    click_events: [{
      "timetamp": Date.now(),
      "caption_key": caption_key,
      "count": request.count,
    }],
  }
  storeImageEventPayload(request.url, payload);
}

function captionUpdateHandler(request, sender, sendResponse) {
  if (request.caption !== undefined) {
    console.log("Received caption update: " + request.caption + "");
    caption = request.caption;
    caption_key = cyrb53hash(caption);
    console.log(caption_key, caption);
    upsert("captions", {'key': caption_key, 'caption': caption, 'updated_at': Date.now()})
  }
}

function settingsUpdateHandler(request, sender, sendResponse) {
  if (request.hostname !== undefined) {
    console.log("Received hostname update: " + request.hostname + "");
    hostname = request.hostname;
    should_remote_post = (request.hostname.length > 0);
  }
};

/**
 * Listener to handle click attribution events on the image records.
 * This function will updated the indexedDB records to record whether
 * and when the images were clicked.
 */
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.type == "image_click") {
      imageClickHandler(request.value, sender, sendResponse);
    } else if (request.type == "settings_update") {
      settingsUpdateHandler(request.value, sender, sendResponse);
    } else if (request.type == "caption_rendered") {
      captionUpdateHandler(request.value, sender, sendResponse);
    }

  }
);

// Retrieve settings values from storage on start
chrome.storage.local.get(["hostname"], function (result) {
  if (result.hostname) {
    hostname = result.hostname;
    should_remote_post = (result.hostname.length > 0);
  }
})
chrome.storage.local.get(["caption"], function (result) {
  if (result.caption) {
    caption = result.caption;
    caption_key = cyrb53hash(caption);
  }
})
