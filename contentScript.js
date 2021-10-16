chrome.webRequest.onCompleted.addListener(contentHandler, {urls: [ "<all_urls>" ], types: ['image']}, []);

function contentHandler(details){
  fout = getFileName(details.url, 'test', '0');
  console.log("Saving " + details.url + " to: " + fout);
  // saveAs(details.url, fout);
  download(details.url, fout);
}
