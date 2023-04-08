const IMAGE_POST_ENDPOINT = "image/";
var hostname = "";
var caption = "";
var caption_key = "";

// Instantiate an indexedDB for the extension to store accumulating image click facts.
var db;
var request = window.indexedDB.open('imgdb', 1);
request.onerror = function(event) {
  console.error("indexedDB could not be opened in the extension..");
};
request.onsuccess = function(event) {
  db = event.target.result;
  console.debug("Created database:", db);
};
request.onerror = function(event) {
  console.error("Failed to create database")
};
request.onupgradeneeded = function(event) {
  var db = event.target.result;
  if (!db.objectStoreNames.contains('images')) {
    var obj = db.createObjectStore('images', {keyPath: 'url'});
    obj.createIndex('url', 'url', {unique: true});
  }
  if (!db.objectStoreNames.contains('captions')) {
    var obj = db.createObjectStore('captions', {keyPath: 'key'});
    // create an index on the string key
    obj.createIndex('key', 'key', {unique: true});
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
function contentHandler(details){
  // Create a cross-header request to GET the image
  // This will typically not actually result in a request,
  // however since the image will be retrieved from cache.
  var xhr = new XMLHttpRequest(),
      blob;
  xhr.open("GET", details.url, true);
  xhr.responseType = "blob";

  xhr.addEventListener("load", function () {
    if (xhr.status === 200) {
      blob = xhr.response;
      let record = {
        url: keyFromUrl(details.url),
        initiator: details.initiator,
        requested_at: details.timeStamp,
        image: blob,
        is_clicked: false,
        first_clicked_at: null
      };

      let txn = db.transaction('images', 'readwrite');
      let obj = txn.objectStore('images');
      let request = obj.add(record);
      request.onsuccess = function() {
        console.debug("Inserted", request.result);
      };
      request.onerror = function(error) {
        if (error.target.error.name != "ConstraintError") {
          console.error("Error inserting " + details.url, error);
        }
      };
    } else {
      console.error("Failed to retrieve image:", details.url);
    }
  }, false);

  xhr.addEventListener("load", function () {
    if (xhr.status === 200) {
      let payload = {
        url: details.url,
        referrer: details.initiator,
        requested_at: details.timeStamp,
        is_clicked: false,
        first_clicked_at: null
      };

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
          "file." + imageTypeFromUrl(details.url)
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
};

function upsert(database, key, payload, onSuccess, onError, mergeFn) {
  let txn = db.transaction(database, 'readwrite');
  let obj = txn.objectStore(database);
  var getRequest = obj.get(key);
  getRequest.onerror = function() {
    var updateRequest = obj.put(record);
    if (onError !== undefined)
      updateRequest.onerror = onError;
    if (onSuccess !== undefined)
      updateRequest.onsuccess = onSuccess;
  };
  getRequest.onsuccess = function(event) {
    var record = {}
    if (mergeFn === undefined) {
      record = {...event.target.result, ...payload};
    } else {
      record = mergeFn(event.target.result, payload);
    }
    var updateRequest = obj.put(record);
    if (onError !== undefined)
      updateRequest.onerror = onError;
    if (onSuccess !== undefined)
      updateRequest.onsuccess = onSuccess;
  };
}

function captionUpdateHandler(request, sender, sendResponse) {
  if (request.caption) {
    console.log("Received caption update: " + request.caption + "");
    caption = request.caption;
    caption_key = cyrb53hash(caption);
    console.log(caption_key, caption);
    upsert("captions", caption_key, {'key': caption_key, 'caption': caption, 'updated_at': Date.now()})
  }
}

function settingsUpdateHandler(request, sender, sendResponse) {
  if (request.hostname) {
    console.log("Received hostname update: " + request.hostname + "");
    hostname = request.hostname;
  }
};

function imageClickHandler(request, sender, sendResponse) {
  console.debug("Received click message for url: " + request.url);
  let txn = db.transaction('images', 'readwrite');
  let obj = txn.objectStore('images');
  let key = keyFromUrl(request.url);
  var getRequest = obj.get(key);
  getRequest.onerror = function() {
    console.error("dbt retrieval error for key: " + key + " (from url) " + request.url, getRequest.error);
    sendResponse({result: 'failure', reason: 'url was not in db'});
  };
  getRequest.onsuccess = function(event) {
    var record = event.target.result;
    console.log("Retrieved record from db: ", record);
    record.is_clicked = true;
    record.first_clicked_at = (record.first_clicked_at == null ? Date.now() : record.first_clicked_at);
    var updateRequest = obj.put(record);
    updateRequest.onerror = function(event) {
      console.error("Failed to update record: " + key, updateRequest.error);
      sendResponse({result: 'failure', reason: updateRequest.error});
    };
    updateRequest.onsuccess = function(event) {
      console.log("Updated record for " + key + " to: ", record);
      sendResponse({result: 'success', reason: 'Updated successful'});
    };
  };
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
  }
})
chrome.storage.local.get(["rendered_caption"], function (result) {
  if (result.rendered_caption) {
    caption = result.rendered_caption;
  }
})
