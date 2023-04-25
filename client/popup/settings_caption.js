const captionInput = document.getElementById('caption-input');
const captionOutput = document.getElementById('caption-output');

// TODO: make these into a variable length list.
const numTemplateVariables = 3
const k1 = document.getElementById("key1");
const k2 = document.getElementById("key2");
const k3 = document.getElementById("key3");
const v1 = document.getElementById("val1");
const v2 = document.getElementById("val2");
const v3 = document.getElementById("val3");


function renderCaption() {
  chrome.storage.local.get(["templateVariables"], function (result) {
    var rendered = captionInput.value;
    if (result.templateVariables !== undefined) {
      for (var i = 0; i < result.templateVariables.length; i++) {
        rendered = rendered.replaceAll(
          result.templateVariables[i].key,
          result.templateVariables[i].value
        );
      }
    }
    if (rendered !== undefined) {
      captionOutput.value = rendered
    }
    chrome.storage.local.set({'caption': rendered});
    chrome.runtime.sendMessage({
      'type': 'update:caption', 'value': {'caption': rendered}
    });
  });
}

function setCaption() {
  chrome.storage.local.set({"captionTemplate": captionInput.value}, function() {
    console.debug("Saved caption template to local storage:", captionInput.value);
  });
  renderCaption();
}

function getCaption() {
  const val = chrome.storage.local.get(["captionTemplate"], function (result) {
    if (result.captionTemplate !== undefined) {
      captionInput.value = result.captionTemplate;
    }
  });
}

function setTemplateVariables() {
  // Save the template variables to local storage in the "templateVariables" key
  chrome.storage.local.set({
    "templateVariables": [
      {key: k1.value, value: v1.value},
      {key: k2.value, value: v2.value},
      {key: k3.value, value: v3.value},
    ]
  }, () => {renderCaption()});
}

function getTemplateVariables() {
  const val = chrome.storage.local.get(["templateVariables"], function (result) {
    if (result.templateVariables !== undefined) { 
      k1.value = result.templateVariables[0].key;
      k2.value = result.templateVariables[1].key;
      k3.value = result.templateVariables[2].key;
      v1.value = result.templateVariables[0].value;
      v2.value = result.templateVariables[1].value;
      v3.value = result.templateVariables[2].value;
    }
  });
}

captionInput.addEventListener('change', setCaption);
k1.addEventListener('change', setTemplateVariables);
k2.addEventListener('change', setTemplateVariables);
k3.addEventListener('change', setTemplateVariables);
v1.addEventListener('change', setTemplateVariables);
v2.addEventListener('change', setTemplateVariables);
v3.addEventListener('change', setTemplateVariables);

getCaption();
getTemplateVariables();
renderCaption();
