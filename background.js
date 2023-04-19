// TODO: make this configurable
const IMAGE_POST_ENDPOINT = "image/";

const DATASTORE_KEYS = {
  "images": "url",
  "captions": "key",
}

var url_rules = ["<all_urls>"];
var save_all_images = false;
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
  // Create a cross-header request to GET the image specified by url
  // This should not actually result in a request over the network,
  // since the image should be retrieved from the browser cache.
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
      upsert('images', record, () => {}, (e) => console.error("Failed to upsert image:", e), mergeImagePayloads);
    } else {
      console.error("Failed to retrieve image:", url);
    }
  }, false);

  if (should_remote_post) {
    xhr.addEventListener("load", function () {
      if (xhr.status === 200) {
        blob = xhr.response;
        chrome.storage.local.get(["token"], function (result) {
          var log_xhr = new XMLHttpRequest();
          var payload_form = new FormData();
          for (const key in payload) {
            payload_form.set(key, payload[key]);
          }
          payload_form.append(
            'img',
            blob,
            `file.${blob.type.split("/").slice(-1)}`
          );
          endpoint = pathJoin(hostname, IMAGE_POST_ENDPOINT)
          log_xhr.open("POST", endpoint, true);
          log_xhr.responseType = 'json';
          log_xhr.setRequestHeader('Authorization', 'Token ' + result.token);
          log_xhr.addEventListener("load", function () {
            if (log_xhr.status === 200) {
              console.debug(`Successful POST for ${url} to: ${endpoint}`, log_xhr.response);
            } else {
              console.error(`Encountered error on POST for ${url} to ${endpoint}`, payload_form, log_xhr.response);
            }
          })
          log_xhr.send(payload_form);
        });
      }
    }, false);
    xhr.send();
  }
};

function downloadHandler(details) {
  if (save_all_images) {
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
  } else {
    console.debug(`Not saving image ${details.url} since save_all_images=${save_all_images}`);
  }
}

function imageClickHandler(request, sender, sendResponse) {
  const payload = {
    url: request.url,
    initiator: request.initiator,
    view_events: [],
    click_events: [{
      "timetamp": request.timestamp,
      "caption_key": caption_key,
      "count": request.count,
    }],
  }
  storeImageEventPayload(request.url, payload);
}

function captionUpdateHandler(request, sender, sendResponse) {
  if (request.caption !== undefined) {
    caption = request.caption;
    caption_key = cyrb53hash(caption);
    console.log(caption_key, caption);
    console.log(`Received caption update: ${caption} (key: ${caption_key})`);
    upsert("captions", {'key': caption_key, 'caption': caption, 'updated_at': Date.now()})
  }
}

function settingsUpdateHandler(request, sender, sendResponse) {
  if (request.hostname !== undefined) {
    hostname = request.hostname;
    should_remote_post = (request.hostname.length > 0);
    console.log("Received hostname update: " + hostname);
  }
};

function urlAllowUpdateHandler(request, sender, sendResponse) {
  if (request.url_rules !== undefined) {
    url_rules = request.url_rules;
    console.log("Received rules update: " + url_rules);
  }
};

function saveAllUpdateHandler(request, sender, sendResponse) {
  if (request.save_all_images !== undefined) {
    save_all_images = request.save_all_images;
    console.log("Received save_all update: " + save_all_images);
  }
};

function updateImageDownloadListener() {
  if (chrome.webRequest.onCompleted.hasListener(downloadHandler)) {
    chrome.webRequest.onCompleted.removeListener(downloadHandler);
  }
  chrome.webRequest.onCompleted.addListener(downloadHandler, {"urls": url_rules, "types": ['image']});
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

/**
 * Listener to handle click attribution events on the image records.
 * This function will updated the indexedDB records to record whether
 * and when the images were clicked.
 */
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log(`Received message: ${request.type}`, request.value);
    if (request.type == "image_click") {
      imageClickHandler(request.value, sender, sendResponse);
    } else if (request.type == "settings_update") {
      settingsUpdateHandler(request.value, sender, sendResponse);
    } else if (request.type == "caption_rendered") {
      captionUpdateHandler(request.value, sender, sendResponse);
    } else if (request.type == "url_rules_update") {
      urlAllowUpdateHandler(request.value, sender, sendResponse);
    } else if (request.type == "save_all_images") {
      saveAllUpdateHandler(request.value, sender, sendResponse);
    } else if (request.type == "get_url_rules") {
      sendResponse({"url_rules": url_rules});
    } else if (request.type == "action:export_db") {
      // exportRequestHandler(request.value, sender, sendResponse).then(console.log);
      console.error("Cannot export image database due to https://bugs.chromium.org/p/chromium/issues/detail?id=1368818")
    };

  }
);

// Retrieve settings values from storage on start
chrome.storage.local.get(["hostname"], function (result) {
  if (result.hostname !== undefined) {
    hostname = result.hostname;
    should_remote_post = (result.hostname.length > 0);
  }
})
chrome.storage.local.get(["caption"], function (result) {
  if (result.caption !== undefined) {
    caption = result.caption;
    caption_key = cyrb53hash(caption);
  }
});
chrome.storage.local.get(["save_all_images"], function (result) {
  if (result.save_all_images !== undefined) {
    save_all_images = result.save_all_images;
  }
});
chrome.storage.local.get(["url_rules"], function (result) {
  if (result.url_rules !== undefined) {
    url_rules = result.url_rules;
  }
  // Default to all urls
  updateImageDownloadListener();
});
