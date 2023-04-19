// TODO: make these configurable for the user
const TOKEN_POST_ENDPOINT = "auth-token/"
const TOKEN_CHECK_ENDPOINT = "auth-check/"

const hostname_input = document.getElementById("hostname");
const form = document.getElementById('form-login');
const form_message = document.getElementById('auth-message');
const form_submit = document.getElementById('auth-submit');

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
        form_message.innerHTML = `
          <div class="alert alert-success" role="alert">
            Local previously cached token was validated. You are logged in.
          </div>
        `
      } else {
        console.error("Provided token was invalid. Received response from server:");
        setBadgeState("error");
        console.error(xhr.response);
        form_message.innerHTML = `
          <div class="alert alert-danger" role="alert">
            Could not validate token: ${xhr.response}
          </div>
        `
      }
    });
    setBadgeState("loading");
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
  form_submit.classList.toggle("disabled");
  form_submit.value = `Loading...`;
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
  xhr.timeout = 3000; 
  xhr.onload = () => {
    if (xhr.status === 200) {
      chrome.storage.local.set({"token": xhr.response["token"]}, function() {
        console.debug("Saved token to local storage:", xhr.response["token"]);
      });
      setBadgeState("success");
      form_message.innerHTML = `
        <div class="alert alert-success" role="alert">
          Login successful. Cached auth token to local storage.
        </div>
      `
    } else {
      console.error(xhr.response);
      setBadgeState("error");
      form_message.innerHTML = `
        <div class="alert alert-danger" role="alert">
          Login failed. Please verify your credentials.
        </div>
      `
    }
    form_submit.classList.toggle("disabled");
    form_submit.value = "Submit";
  };
  xhr.ontimeout = (e) => {
    form_submit.classList.toggle("disabled");
    form_submit.value = "Submit";
    form_message.innerHTML = `
      <div class="alert alert-danger" role="alert">
        Login timed out. Please verify the server hostname.
      </div>
    `
  }
  xhr.onerror = (e) => {
    form_submit.classList.toggle("disabled");
    form_submit.value = "Submit";
    form_message.innerHTML = `
      <div class="alert alert-danger" role="alert">
        Failed to connect to server. Please verify the server hostname.
      </div>
    `
  }

  xhr.send(JSON.stringify(payload))
}

form.addEventListener('submit', loginAndFetchToken);
setLastHostnameInLoginForm();
checkLocalToken();
