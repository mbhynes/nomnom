const IMAGE_POST_ENDPOINT = "http://127.0.0.1:8000/api/image/"

// Instantiate an indexedDB for the extension to store accumulating image click facts.
var db;
var request = window.indexedDB.open('imgdb', 1);request.onerror = function(event) {
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
};

// Add callbacks on all downloaded images during the session
chrome.webRequest.onCompleted.addListener(contentHandler, {
  urls: [ "<all_urls>" ],
  types: ['image']
}, []);

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

        log_xhr.open("POST", IMAGE_POST_ENDPOINT, true);
        log_xhr.responseType = 'json';
        log_xhr.setRequestHeader('Authorization', 'Token ' + result.token);
        console.debug("Posting payload with token:", result.token);
        console.debug("Blob:", blob);
        log_xhr.addEventListener("load", function () {
          if (log_xhr.status === 200) {
            console.debug("Successful POST:", log_xhr.status, log_xhr.response);
          } else {
            console.error("Encountered error on POST:", log_xhr.status, log_xhr.response);
          }
        })
        log_xhr.send(payload_form);
      });
    }
  }, false);
  xhr.send();
};

/**
 * Listener to handle click attribution events on the image records.
 * This function will updated the indexedDB records to record whether
 * and when the images were clicked.
 */
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
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
  }
);
