const exportButton = document.getElementById('export-button');

exportButton.addEventListener('click', async () => {
  var extractAt = Date.now();
  chrome.runtime.sendMessage({
    "type": "event:export_db",
    "value": {"extract_at": extractAt},
  })
});
