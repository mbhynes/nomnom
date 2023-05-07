// TODO: make these configurable for the user
const TOKEN_POST_ENDPOINT = "auth-token/"
const TOKEN_CHECK_ENDPOINT = "auth-check/"

const usernameInput = document.getElementById("username");
const hostnameInput = document.getElementById("hostname");
const form = document.getElementById('form-login');
const formMessage = document.getElementById('auth-message');
const formSubmit = document.getElementById('auth-submit');

function pathJoin(base, path) {
  return [base, path].join('/').replace(/\/+/g, '/');
}

function setLastHostnameInLoginForm(state) {
  const hostname = chrome.storage.local.get(["hostname"], function (result) {
    if (result.hostname) {
      hostnameInput.value = result.hostname;
    }
  })
}

function setLastUsernameInLoginForm(state) {
  const username = chrome.storage.local.get(["username"], function (result) {
    if (result.username) {
      usernameInput.value = result.username;
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
    const tokenCheckEndpoint = pathJoin(res.hostname, TOKEN_CHECK_ENDPOINT);
    var result = false;
    var xhr = new XMLHttpRequest();
    // submit the GET request synchronously to block on receipt of token validation
    xhr.open("GET", tokenCheckEndpoint, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Token ' + token);
    xhr.addEventListener("load", function () {
      if (xhr.status === 200) {
        console.debug("Provided token was validated. Received response from server:");
        console.debug(xhr.response);
        setBadgeState("success");
        formMessage.innerHTML = `
          <div class="alert alert-success" role="alert">
            Local previously cached token was validated. You are logged in.
          </div>
        `
      } else {
        console.error("Provided token was invalid. Received response from server:");
        setBadgeState("error");
        console.error(xhr.response);
        formMessage.innerHTML = `
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
  formSubmit.classList.toggle("disabled");
  formSubmit.value = `Loading...`;
  const username = e.target.elements.username.value;
  const hostname = e.target.elements.hostname.value;
  const payload = {
    "username": username,
    "password": e.target.elements.password.value,
  };
  chrome.storage.local.set({"hostname": hostname}, function() {
    console.debug("Saved hostname to local storage:", hostname);
  });
  chrome.storage.local.get(["username"], function (result) {
    if (result.username !== username) {
      // NB there's a small risk of a race condition here if clearing the 
      // local token takes longer than the authentication post request.
      // In this case, the token received from the server would be cleared
      // and the user's post requests would fail to be authenticated without
      // the user being aware of it. Pretty shitty, but this is unlikely.
      chrome.storage.local.set({"token": null}, function() {
        console.debug("Cleared token from local storage");
      });
      chrome.runtime.sendMessage({
        'type': 'update:token', 'value': {'token': null}
      });
      chrome.storage.local.set({"username": username}, function() {
        console.debug("Saved username to local storage:", hostname);
      });
    }
  });
  chrome.runtime.sendMessage({
    'type': 'update:hostname', 'value': {'hostname': hostname}
  });
  const tokenPostEndpoint = pathJoin(hostname, TOKEN_POST_ENDPOINT);
  console.debug("Posting auth to endpoint:", tokenPostEndpoint);
  var xhr = new XMLHttpRequest();
  xhr.open("POST", tokenPostEndpoint, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.responseType = "json"
  xhr.timeout = 3000; 
  xhr.onload = () => {
    if (xhr.status === 200) {
      chrome.storage.local.set({"token": xhr.response["token"]}, function() {
        console.debug("Saved token to local storage:", xhr.response["token"]);
        chrome.runtime.sendMessage({
          'type': 'update:token', 'value': {'token': xhr.response["token"]}
        });
      });
      setBadgeState("success");
      formMessage.innerHTML = `
        <div class="alert alert-success" role="alert">
          Login successful. Cached auth token to local storage.
        </div>
      `
    } else {
      console.error(xhr.response);
      setBadgeState("error");
      formMessage.innerHTML = `
        <div class="alert alert-danger" role="alert">
          Login failed. Please verify your credentials.
        </div>
      `
    }
    formSubmit.classList.toggle("disabled");
    formSubmit.value = "Submit";
  };
  xhr.ontimeout = (e) => {
    formSubmit.classList.toggle("disabled");
    formSubmit.value = "Submit";
    formMessage.innerHTML = `
      <div class="alert alert-danger" role="alert">
        Login timed out. Please verify the server hostname.
      </div>
    `
  }
  xhr.onerror = (e) => {
    formSubmit.classList.toggle("disabled");
    formSubmit.value = "Submit";
    formMessage.innerHTML = `
      <div class="alert alert-danger" role="alert">
        Failed to connect to server. Please verify the server hostname.
      </div>
    `
  }
  xhr.send(JSON.stringify(payload))
}

form.addEventListener('submit', loginAndFetchToken);
setLastHostnameInLoginForm();
setLastUsernameInLoginForm();
checkLocalToken();
