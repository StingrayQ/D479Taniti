(function(window, undefined) {
  var dictionary = {
    "7dbe1c5a-c4a2-47ba-b994-8276354d23fc": "Transportation",
    "bc5e36b8-1baa-404c-8718-ccc24df40007": "Entertainment",
    "60cd0f4e-1d63-4103-bb39-e1741bc01e2f": "About",
    "b5c6b7f7-ab2b-4560-95a1-03b52b500085": "Reservations",
    "d12245cc-1680-458d-89dd-4f0d7fb22724": "Main",
    "f39803f7-df02-4169-93eb-7547fb8c961a": "Template 1",
    "bb8abf58-f55e-472d-af05-a7d1bb0cc014": "Board 1"
  };

  var uriRE = /^(\/#)?(screens|templates|masters|scenarios)\/(.*)(\.html)?/;
  window.lookUpURL = function(fragment) {
    var matches = uriRE.exec(fragment || "") || [],
        folder = matches[2] || "",
        canvas = matches[3] || "",
        name, url;
    if(dictionary.hasOwnProperty(canvas)) { /* search by name */
      url = folder + "/" + canvas;
    }
    return url;
  };

  window.lookUpName = function(fragment) {
    var matches = uriRE.exec(fragment || "") || [],
        folder = matches[2] || "",
        canvas = matches[3] || "",
        name, canvasName;
    if(dictionary.hasOwnProperty(canvas)) { /* search by name */
      canvasName = dictionary[canvas];
    }
    return canvasName;
  };
})(window);