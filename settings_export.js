const export_button = document.getElementById('export-button');

export_button.addEventListener('click', async () => {
  try {
    const directoryHandle = await window.showDirectoryPicker();
    console.log(directoryHandle);
  } catch (error) {
    alert(error.name, error.message);
  }
});
