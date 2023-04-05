const caption_input = document.getElementById('caption-input');
const caption_output = document.getElementById('caption-output');
const k1 = document.getElementById("key1");
const k2 = document.getElementById("key2");
const k3 = document.getElementById("key3");
const v1 = document.getElementById("val1");
const v2 = document.getElementById("val2");
const v3 = document.getElementById("val3");


function renderCaption() {
  const val = chrome.storage.local.get(["template_variables"], function (result) {
    console.log(result);
    var rendered = caption_input.value;
    for (var i = 0; i < result.template_variables.length; i++) {
      rendered = rendered.replaceAll(result.template_variables[i].key, result.template_variables[i].value);
    }
    caption_output.value = rendered
    chrome.storage.set(['rendered_caption'], rendered);
    chrome.runtime.sendMessage({
      'type': 'label_rendered', 'value': {'label': rendered}
    });
  });
}

function setCaption() {
  var caption_input = document.getElementById("caption-input");
  chrome.storage.local.set({"caption": caption_input.value}, function() {
    console.debug("Saved caption to local storage:", caption_input.value);
  });
  renderCaption();
}

function getCaption() {
  const val = chrome.storage.local.get(["caption"], function (result) {
    var caption_input = document.getElementById("caption-input");
    caption_input.value = result.caption;
  });
}

function setTemplateVariables() {
  // Save the template variables to local storage in the "template_variables" key
  chrome.storage.local.set({
    "template_variables": [
      {key: document.getElementById("key1").value, value: document.getElementById("val1").value},
      {key: document.getElementById("key2").value, value: document.getElementById("val2").value},
      {key: document.getElementById("key3").value, value: document.getElementById("val3").value},
    ]
  }, function() {
    console.debug("Saved template variables to local storage.");
  });
  renderCaption();
}

function getTemplateVariables() {
  const val = chrome.storage.local.get(["template_variables"], function (result) {
    k1.value = result.template_variables[0].key;
    k2.value = result.template_variables[1].key;
    k3.value = result.template_variables[2].key;
    v1.value = result.template_variables[0].value;
    v2.value = result.template_variables[1].value;
    v3.value = result.template_variables[2].value;
  });
}

caption_input.addEventListener('change', setCaption);
k1.addEventListener('change', setTemplateVariables);
k2.addEventListener('change', setTemplateVariables);
k3.addEventListener('change', setTemplateVariables);
v1.addEventListener('change', setTemplateVariables);
v2.addEventListener('change', setTemplateVariables);
v3.addEventListener('change', setTemplateVariables);

getCaption();
getTemplateVariables();
renderCaption();
