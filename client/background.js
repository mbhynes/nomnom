// TODO: make this configurable
const IMAGE_POST_ENDPOINT = "image/";

const DATASTORE_KEYS = {
  "images": "url",
  "captions": "key",
}

var urlRules = ["<all_urls>"];
var saveAllImages = false;
var shouldRemotePost = false;
var hostname = "";
var token = "";
var caption = "";
var captionKey = cyrb53hash("");

// Instantiate an indexedDB for the extension to store accumulating image click facts.
var db;
var request = window.indexedDB.open('imgdb', 1);
request.onerror = function(event) {
  console.error("indexedDB could not be opened in the extension..");
};
request.onsuccess = function(event) {
  db = event.target.result;
  console.debug("Opened database:", db);
  setupStateOnStart();
};
request.onerror = function(event) {
  console.error("Failed to open database")
};
request.onupgradeneeded = function(event) {
  var db = event.target.result;
  if (!db.objectStoreNames.contains('images')) {
    var obj = db.createObjectStore('images', {"keyPath": DATASTORE_KEYS['images']});
    obj.createIndex(DATASTORE_KEYS['images'], DATASTORE_KEYS['images'], {unique: true});
  }
  if (!db.objectStoreNames.contains('captions')) {
    var obj = db.createObjectStore('captions', {"keyPath": DATASTORE_KEYS['captions']});
    // create an index on the string key
    obj.createIndex(DATASTORE_KEYS['captions'], DATASTORE_KEYS['captions'], {unique: true});
  }
};

function pathJoin(base, path) {
  return [base, path].join('/').replace(/\/+/g, '/');
}

/**
 * Convenience utility to merge 2 image payload dictionaries into 1 new record
 * that may be upserted into the database.
 */
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

/**
 * Upsert (insert or update) a record into the indexedDB database.
 */
function upsert(database, payload, onSuccess, onError, mergeFn) {
  const obj = db.transaction([database], "readwrite").objectStore(database);
  const key = payload[DATASTORE_KEYS[database]];
  const getRequest = obj.get(key);
  getRequest.onerror = function(event) {
    console.error("Error getting record:", event.target.errorCode);
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
      var record;
      if (mergeFn === undefined) {
        record = {...result, ...payload};
      } else {
        record = mergeFn(result, payload);
      }
      var updateRequest = obj.put(record);
      if (onError !== undefined)
        updateRequest.onerror = onError;
      if (onSuccess !== undefined)
        updateRequest.onsuccess = onSuccess;
    }
  };
}

function payloadToFormData(payload, blob) {
    let form = new FormData();
    form.append("image", blob, `file.${blob.type.split("/").slice(-1)}`);
    form.append("url", payload["url"]);
    form.append("event_type", payload["event"]["event_type"]);
    form.append("initiator", payload["event"]["initiator"]);
    form.append("timestamp", payload["event"]["timestamp"]);
    form.append("count", payload["event"]["count"]);
    form.append("caption", JSON.stringify(payload["event"]["caption"]));
    console.log("form fields:");
    return form;
}

/**
 * Store image interaction events to the indexedDB database and (optionally) a remote server.
 *
 * This function will store view and click event data using the following schema:
 * {
 *   url (string):                the image url
 *   initiator (string):          referring site from which the request was placed
 *   image (Blob):                the image data
 *   view_events:                 a list of dictionary events representing views (downloads)
 *   click_events:                a list of dictionary events representing clicks on the image
 * }
 *
 * The view_events and click_events fields are lists of dictionaries with the following schema:
 * {
 *   timestamp (numeric):         epoch-millisecond timestamp of the event
 *   captionKey (numeric):        hash of the caption at the time of the event
 *   count (integer):             a value of +1 or -1 representing the net difference in event count;
 *                                a negative value encodes a count adjustment since a user may "unclick"
 *                                an image to indicate that a previous click should be annulled.
 * }
 *
 * When saving event data to the local indexedDB, the records will be upserted such that new click
 * and view events are appended to list on existing records (an append update).
 *
 * However, when posting the payload to a remote server, only the incremental event payload (ie the
 * last element of the list to append) is sent; the server is responsible for merging the new event
 * with existing data and handling out-of-order events if this is desired.
 */
function storeImageEventPayload(url, payload) {
  console.debug(`Storing image event payload for ${url}:`, payload);
  // Create a cross-header request to GET the image specified by url
  // This should not actually result in a request over the network,
  // since the image should be retrieved from the browser cache.
  var xhr = new XMLHttpRequest(),
      blob;
  xhr.open("GET", url, true);
  xhr.responseType = "blob";

  xhr.addEventListener("load", function () {
    if (xhr.status === 200) {
      blob = xhr.response;
      var record = {
        "url": url,
        "img": blob,
      };
      if (payload["event"]["event_type"] == "click") {
        record["click_events"] = [payload["event"]];
        record["view_events"] = [];
      } else if (payload["event"]["event_type"] == "view") {
        record["click_events"] = [];
        record["view_events"] = [payload["event"]];
      }
      upsert('images', record, () => {}, (e) => console.error("Failed to upsert image:", e), mergeImagePayloads);
    } else {
      console.error("Failed to retrieve image:", url);
    }
  }, false);

  if (shouldRemotePost) {
    xhr.addEventListener("load", function () {
      if (xhr.status === 200) {
        blob = xhr.response;
        var log_xhr = new XMLHttpRequest();
        const payload_form = payloadToFormData(payload, blob);
        for (var pair of payload_form.entries()) {
          console.log(pair[0]+ ', ' + pair[1]); 
        }
        endpoint = pathJoin(hostname, IMAGE_POST_ENDPOINT)
        log_xhr.open("POST", endpoint, true);
        log_xhr.responseType = 'json';
        log_xhr.setRequestHeader('Authorization', 'Token ' + token);
        log_xhr.addEventListener("load", function () {
          if (log_xhr.status === 200) {
            console.debug(`Successful POST for ${url} to: ${endpoint}`, log_xhr.response);
          } else {
            console.error(`Encountered error on POST for ${url} to ${endpoint}`, payload_form, log_xhr.response);
          }
        })
        log_xhr.send(payload_form);
      } else {
        console.error(`XMLHttpRequest failure when downloading image:{url}:`, xhr);
      }
    }, false);
  }
  xhr.send();
};

function downloadHandler(details) {
  if (saveAllImages) {
    const payload = {
      "url": details.url,
      "event": {
        "caption": {
          "text": caption,
          "key": captionKey
        },
        "event_type": "view",
        "initiator": details.initiator,
        "timestamp": details.timeStamp,
        "count": 1,
      }
    }
    storeImageEventPayload(details.url, payload);
  } else {
    console.debug(`Not saving image ${details.url} since saveAllImages=${saveAllImages}`);
  }
}

function imageClickHandler(request, sender, sendResponse) {
  const payload = {
    "url": request.url,
    "event": {
      "caption": {
        "text": caption,
        "key": captionKey,
      },
      "event_type": "click",
      "initiator": request.initiator,
      "timestamp": request.timestamp,
      "count": request.count,
    },
  }
  storeImageEventPayload(request.url, payload);
}

function captionUpdateHandler(request, sender, sendResponse) {
  if (request.caption !== undefined) {
    caption = request.caption;
    captionKey = cyrb53hash(caption);
    console.debug(`Received caption update: ${caption} (key: ${captionKey})`);
    upsert("captions", {'key': captionKey, 'caption': caption, 'updated_at': new Date()})
  }
}

function hostnameUpdateHandler(request, sender, sendResponse) {
  if (request.hostname !== undefined) {
    hostname = request.hostname;
    shouldRemotePost = (request.hostname.length > 0);
    console.debug("Received hostname update:", hostname);
  }
};

function tokenUpdateHandler(request, sender, sendResponse) {
  if (request.token !== undefined) {
    token = request.token;
    console.debug("Received token update:", token);
  }
};

function urlRulesUpdateHandler(request, sender, sendResponse) {
  if (request.urlRules !== undefined) {
    urlRules = request.urlRules;
    updateImageDownloadListener();
    console.log("Received rules update", urlRules);
  }
};

function saveAllUpdateHandler(request, sender, sendResponse) {
  if (request.saveAllImages !== undefined) {
    saveAllImages = request.saveAllImages;
    console.log("Received save_all update:", saveAllImages);
  }
};

/**
 * Rremove any existing downloadHandler from the download event 
 * (chrome.webRequest.onCompleted), and replace it with a new
 * listener using the current value of urlRules.
 */
function updateImageDownloadListener() {
  if (chrome.webRequest.onCompleted.hasListener(downloadHandler)) {
    chrome.webRequest.onCompleted.removeListener(downloadHandler);
  }
  chrome.webRequest.onCompleted.addListener(downloadHandler, {"urls": urlRules, "types": ['image']});
  chrome.webRequest.handlerBehaviorChanged();
}

// TODO: implement this after the upstream error is fixed. Currently it 
// is not possible to use window.showDirectoryPicker() in either an extension
// or a background script (service worker in manifest v3).
//  - https://bugs.chromium.org/p/chromium/issues/detail?id=1368818
//  - https://github.com/WICG/file-system-access/issues/289 
//  - https://bugs.chromium.org/p/chromium/issues/detail?id=1359786
async function exportRequestHandler(request) {
  const parentDirectoryHandle = await window.showDirectoryPicker();
  const directoryHandle = await parentDirectoryHandle.getDirectoryHandle(`nomnom_image_export_${request.extractAt}`, {
    create: true,
  });
  // TODO: 
  // - open a cursor to iterator over the indexed DB
  // - retreive each record last updated before extractAt
  // - add some watermark metadata in the db for incremental CDC extract
}

function setupStateOnStart() {
  // Retrieve settings values from storage on start
  chrome.storage.local.get(["hostname"], function (result) {
    hostnameUpdateHandler(result, null, null);
  });
  chrome.storage.local.get(["token"], function (result) {
    tokenUpdateHandler(result, null, null);
  });
  chrome.storage.local.get(["caption"], function (result) {
    captionUpdateHandler(result, null, null);
  });
  chrome.storage.local.get(["saveAllImages"], function (result) {
    saveAllUpdateHandler(result, null, null);
  });
  chrome.storage.local.get(["urlRules"], function (result) {
    urlRulesUpdateHandler(result, null, null);
  });

  updateImageDownloadListener();
}

/**
 * Listener to handle click attribution events on the image records.
 * This function will updated the indexedDB records to record whether
 * and when the images were clicked.
 */
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.debug(`Received message: ${request.type}`, request.value);
    if (request.type == "event:image_click") {
      imageClickHandler(request.value, sender, sendResponse);
    } else if (request.type == "update:hostname") {
      hostnameUpdateHandler(request.value, sender, sendResponse);
    } else if (request.type == "update:token") {
      tokenUpdateHandler(request.value, sender, sendResponse);
    } else if (request.type == "update:caption") {
      captionUpdateHandler(request.value, sender, sendResponse);
    } else if (request.type == "update:urlRules") {
      urlRulesUpdateHandler(request.value, sender, sendResponse);
    } else if (request.type == "update:saveAllImages") {
      saveAllUpdateHandler(request.value, sender, sendResponse);
    } else if (request.type == "get:urlRules") {
      sendResponse({"urlRules": urlRules});
    } else if (request.type == "event:export_db") {
      // exportRequestHandler(request.value, sender, sendResponse).then(console.log);
      console.error("Cannot export image database due to https://bugs.chromium.org/p/chromium/issues/detail?id=1368818")
    };
  }
);
