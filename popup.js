const TOKEN_POST_ENDPOINT = "http://127.0.0.1:8000/api/auth-token/"
const TOKEN_CHECK_ENDPOINT = "http://127.0.0.1:8000/api/auth-check/"

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
  var result = false;
  var xhr = new XMLHttpRequest();
  // submit the GET request synchronously to block on receipt of token validation
  xhr.open("GET", TOKEN_CHECK_ENDPOINT, false);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Authorization', 'Token ' + token);
  xhr.addEventListener("load", function () {
    if (xhr.status === 200) {
      console.debug("Provided token was validated. Received response from server:");
      console.debug(xhr.response);
      result = true;
    } else {
      console.error("Provided token was invalid. Received response from server:");
      console.error(xhr.response);
    }
  });
  xhr.send();
  return (xhr.status === 200);
}


function checkLocalToken() {
  setBadgeState("loading");
  const token = chrome.storage.local.get(["token"], function (result) {
    console.debug("Retrieved token from local storage:", result.token);
    if (isTokenValid(result.token)) {
      console.debug("Validated token against: ", TOKEN_CHECK_ENDPOINT);
      setBadgeState("success");
    } else {
      setBadgeState("error");
      console.error("Token was invalid");
    }
  });
}

function loginAndFetchToken(e) {
  e.preventDefault();
  const payload = {
    "username": e.target.elements.username.value,
    "password": e.target.elements.password.value,
  };
  var xhr = new XMLHttpRequest();
  xhr.open("POST", TOKEN_POST_ENDPOINT, true);
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

const form = document.getElementById('form-login');
form.addEventListener('submit', loginAndFetchToken);

checkLocalToken();
