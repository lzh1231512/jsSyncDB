/// <reference path="../tools.js" />
/// <reference path="../DB/base/dbCache.js" />
(function () {
    var dbCache = JssDB.dbCache;
    var ch = new dbCache(100);
    for (var i = 0; i < 25; i++) {
        ch.set('s' + i, '12345678');
    }
    console.log(ch.length);
})();