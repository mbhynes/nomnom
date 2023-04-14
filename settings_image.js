const save_all = document.getElementById('save-all-input');
const url_rules = document.getElementById('url-rules-input');

function setSaveAll() {
  chrome.storage.local.set({"save_all_images": save_all.value}, function(result) {
    console.debug("Set save_all to state:", save_all.value);
  });
  // TODO: send a message
}

function getSaveAll() {
  const val = chrome.storage.local.get(["save_all_images"], function (result) {
    save_all.value = result.save_all_images;
  });
}

function parseUrlRules(str) {
  var rules = str.split(',');
  return rules.map(r => r.trim());
}

function setUrlRules() {
  var input = "<all_urls>";
  if (url_rules.value.trim() !== "") {
    input = url_rules.value;
  }
  const rules = parseUrlRules(input);
  chrome.storage.local.set({"url_rules": rules}, function(result) {
    console.debug("Set url rules to:", rules);
  });
  // TODO: send a message for the new rules
  chrome.runtime.sendMessage({
    'type': 'url_rules_update', 'value': {'url_rules': rules}
  });
}

function getUrlRules() {
  const val = chrome.storage.local.get(["url_rules"], function (result) {
    url_rules.value = result.url_rules.join(",\n");
  });
}

save_all.addEventListener('change', setSaveAll);
url_rules.addEventListener('change', setUrlRules);

getSaveAll();
getUrlRules();
