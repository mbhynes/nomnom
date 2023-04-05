const TOKEN_POST_ENDPOINT = "auth-token/"
const TOKEN_CHECK_ENDPOINT = "auth-check/"

const hostname_input = document.getElementById("hostname");
const form = document.getElementById('form-login');
const form_spinner = document.getElementById('auth-spinner');
const form_message = document.getElementById('auth-message');

function pathJoin(base, path) {
  return [base, path].join('/').replace(/\/+/g, '/');
}

function setLastHostnameInLoginForm(state) {
  const hostname = chrome.storage.local.get(["hostname"], function (result) {
    if (result.hostname) {
      hostname_input.value = result.hostname;
    }
  })
}


function setBadgeState(state) {
  if (state === "loading") {
    chrome.browserAction.setBadgeText({"text": "..."});
    chrome.browserAction.setBadgeBackgroundColor({"color": "#666666"});
  } else if (state === "success") {
    chrome.browserAction.setBadgeText({"text": "ok"});
    chrome.browserAction.setBadgeBackgroundColor({"color": "#00AA00"});
  } else {
    chrome.browserAction.setBadgeText({"text": "x"});
    chrome.browserAction.setBadgeBackgroundColor({"color": "#AA0000"});
  }
}

function isTokenValid(token) {
  const hostname = chrome.storage.local.get(["hostname"], function (res) {
    console.debug("Checking token validity against: ", res.hostname);
    const token_check_endpoint = pathJoin(res.hostname, TOKEN_CHECK_ENDPOINT);
    var result = false;
    var xhr = new XMLHttpRequest();
    // submit the GET request synchronously to block on receipt of token validation
    xhr.open("GET", token_check_endpoint, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Token ' + token);
    xhr.addEventListener("load", function () {
      if (xhr.status === 200) {
        console.debug("Provided token was validated. Received response from server:");
        console.debug(xhr.response);
        setBadgeState("success");
        result = true;
      } else {
        console.error("Provided token was invalid. Received response from server:");
        setBadgeState("error");
        console.error(xhr.response);
      }
    });
    xhr.send();
    return (xhr.status === 200);
  })
}

function checkLocalToken() {
  setBadgeState("loading");
  const token = chrome.storage.local.get(["token"], function (result) {
    console.debug("Retrieved token from local storage:", result.token);
    if (isTokenValid(result.token)) {
      console.debug("Validated token against: ", TOKEN_CHECK_ENDPOINT);
    } else {
      console.error("Token was invalid");
    }
  });
}


function loginAndFetchToken(e) {
  e.preventDefault();
  const hostname = e.target.elements.hostname.value;
  const payload = {
    "username": e.target.elements.username.value,
    "password": e.target.elements.password.value,
  };
  chrome.storage.local.set({"hostname": hostname}, function() {
    console.debug("Saved hostname to local storage:", hostname);
  });
  chrome.runtime.sendMessage({
    'type': 'settings_update', 'value': {'hostname': hostname}
  });
  const token_post_endpoint = pathJoin(hostname, TOKEN_POST_ENDPOINT);
  console.debug("Posting to endpoint:", token_post_endpoint);
  var xhr = new XMLHttpRequest();
  xhr.open("POST", token_post_endpoint, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.responseType = "json"
  xhr.addEventListener("load", function () {
    if (xhr.status === 200) {
      chrome.storage.local.set({"token": xhr.response["token"]}, function() {
        console.debug("Saved token to local storage:", xhr.response["token"]);
      });
      setBadgeState("success");
    } else {
      console.error(xhr.response);
      setBadgeState("error");
    }
  });
  setBadgeState("loading");
  xhr.send(JSON.stringify(payload))
}

function setBadgeState(state) {
  if (state === "loading") {
    chrome.browserAction.setBadgeText({"text": "..."});
    chrome.browserAction.setBadgeBackgroundColor({"color": "#666666"});
  } else if (state === "success") {
    chrome.browserAction.setBadgeText({"text": "ok"});
    chrome.browserAction.setBadgeBackgroundColor({"color": "#00AA00"});
  } else {
    chrome.browserAction.setBadgeText({"text": "x"});
    chrome.browserAction.setBadgeBackgroundColor({"color": "#AA0000"});
  }
}

form.addEventListener('submit', loginAndFetchToken);
setLastHostnameInLoginForm();
checkLocalToken();
