
function logSubmit(e) {
  e.preventDefault();
  const payload = {
    "username": e.target.elements.username.value,
    "password": e.target.elements.password.value,
  };
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "http://127.0.0.1:8000/api/auth-token/", true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.responseType = "json"
  xhr.addEventListener("load", function () {
    if (xhr.status === 200) {
      console.info(xhr.response);
      console.info(xhr.response["token"]);
      chrome.storage.local.set({"token": xhr.response["token"]}, function() {
        console.log("Save token to local storage");
      });
      chrome.browserAction.setBadgeText({"text": "ok"});
      chrome.browserAction.setBadgeBackgroundColor({"color": "#00AA00"});
    } else {
      console.error(xhr.response);
      chrome.browserAction.setBadgeText({"text": "X"});
      chrome.browserAction.setBadgeBackgroundColor({"color": "#AA0000"});
    }
  });
  xhr.send(JSON.stringify(payload))
}

const form = document.getElementById('form-login');
console.error(form);
form.addEventListener('submit', logSubmit);
