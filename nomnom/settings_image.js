var saveAllImages = document.getElementById('save-all-input');
var urlRules = document.getElementById('url-rules-input');

function setSaveAll() {
  console.log(saveAllImages);
  const value = saveAllImages.checked;
  chrome.storage.local.set({"saveAllImages": value}, function(result) {
    console.debug("Set saveAllImages to state:", value);
  });
   chrome.runtime.sendMessage({
    'type': 'update:saveAllImages', 'value': {'saveAllImages': value}
  });
}

function getSaveAll() {
  chrome.storage.local.get(["saveAllImages"], function (result) {
    saveAllImages.checked = result.saveAllImages;
  });
}

function parseUrlRules(str) {
  var rules = str.split(',');
  return rules.map(r => r.trim());
}

function setUrlRules() {
  var input = "<all_urls>";
  if (urlRules.value.trim() !== "") {
    input = urlRules.value;
  }
  const rules = parseUrlRules(input);
  chrome.storage.local.set({"urlRules": rules}, function(result) {
    console.debug("Set url rules to:", rules);
  });
  chrome.runtime.sendMessage({
    'type': 'update:urlRules', 'value': {'urlRules': rules}
  });
}

function getUrlRules() {
  const val = chrome.storage.local.get(["urlRules"], function (result) {
    urlRules.value = result.urlRules.join(",\n");
  });
}

saveAllImages.addEventListener('change', setSaveAll);
urlRules.addEventListener('change', setUrlRules);

getSaveAll();
getUrlRules();
