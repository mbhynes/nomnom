function hashCode(s) {
  var hash = 0, i, chr;
  if (s.length === 0) {
    return hash;
  }
  for (i = 0; i < s.length; i++) {
    chr = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

function getFileName(s, label, selected) {
  fileparts = s.split('.');
  allowed_extensions = new Set(['jpeg', 'jpg', 'png']);
  default_extension = 'jpg';
  if (fileparts.length > 2) {
    extension = fileparts.pop().toLowerCase();
  } else {
    extension = default_extension;
  }
  if (!allowed_extensions.has(extension)) {
    extension = default_extension;
  }
  return label + '-' + selected + '-' + Date.now().toString() + '-' + hashCode(s) + '.' + extension
};
