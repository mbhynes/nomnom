var save_all_images = document.getElementById('save-all-input');
var url_rules = document.getElementById('url-rules-input');

function setSaveAll() {
  console.log(save_all_images);
  const value = save_all_images.checked;
  chrome.storage.local.set({"save_all_images": value}, function(result) {
    console.debug("Set save_all to state:", value);
  });
   chrome.runtime.sendMessage({
    'type': 'save_all_images', 'value': {'save_all_images': value}
  });
}

function getSaveAll() {
  chrome.storage.local.get(["save_all_images"], function (result) {
    console.log("get save_all_images:", result.save_all_images)
    save_all_images.checked = result.save_all_images;
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
  chrome.runtime.sendMessage({
    'type': 'url_rules_update', 'value': {'url_rules': rules}
  });
}

function getUrlRules() {
  const val = chrome.storage.local.get(["url_rules"], function (result) {
    url_rules.value = result.url_rules.join(",\n");
  });
}

save_all_images.addEventListener('change', setSaveAll);
url_rules.addEventListener('change', setUrlRules);

getSaveAll();
getUrlRules();
