const export_button = document.getElementById('export-button');

async function openDirectory(win) {
  console.log("window", win);
  let parentDirectoryHandle = await win.showDirectoryPicker();
  // In an existing directory, create a new directory named "My Documents".
  const directoryHandle = await parentDirectoryHandle.getDirectoryHandle(`nomnom_image_export_${extractAt}`, {
    create: true,
  });
  return directoryHandle
}

export_button.addEventListener('click', async () => {
  var extractAt = Date.now();
  chrome.runtime.sendMessage({
    "type": "action:export_db",
    "value": {"extract_at": extractAt},
  })
});
