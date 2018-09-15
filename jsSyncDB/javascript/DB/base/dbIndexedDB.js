/// <reference path="dbCache.js" />
function MyDbIndexedDB(dbName) {
    var DbName = dbName;
    var storeName = "t_main";
    var db = null;
    
    function openDB(callback) {
        if (db) {
            callback(db);
            return;
        }
        var version = 1;
        var request = window.indexedDB.open(DbName, version);
        request.onerror = function (e) {
            console.log(e.currentTarget.error.message);
        };
        request.onsuccess = function (e) {
            db = e.target.result;
            callback(db);
        };
        request.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "key" });
            }
        };
    }

    this.delCmd = function (key, sqlCMD) {
        sqlCMD.push({ ac: 'del', key: key });
    }
    this.addCmd = function (key, val, sqlCMD) {
        sqlCMD.push({ ac: 'set', key: key, val: val });
    }
    this.exec = function (sqlCMD,theCache2, callback) {
        openDB(function () {
            var transaction = db.transaction(storeName, 'readwrite');
            var store = transaction.objectStore(storeName);
            for (var i = 0; i < sqlCMD.length; i++) {
                theCache2.set(sqlCMD[i].key, sqlCMD[i].val);
                var request;
                if (sqlCMD[i].ac == 'del') {
                    request = store.delete(sqlCMD[i].key);
                } else {
                    delete sqlCMD[i].ac;
                    request = store.put(sqlCMD[i]);
                }
                request.onerror = function (event) {
                    console.log(event);
                }
                if (i == sqlCMD.length - 1) {
                    request.onsuccess = function () {
                        callback();
                    };
                }
            }
        });
    }
    this.getVals = function (keys, isJSON, callback) {
        if (!keys.length) {
            callback([]);
            return;
        }
        var theKeys = clone(keys);
        openDB(function () {
            var res = [];
            var ind = 0;
            function _d() {
                var tmpkeys = [];
                for (var i = 0; i < 100 && ind < keys.length; i++, ind++) {
                    tmpkeys.push(keys[ind]);
                }
                var transaction = db.transaction(storeName, 'readwrite');
                var store = transaction.objectStore(storeName);
                for (var i = 0; i < tmpkeys.length; i++) {
                    if (i < tmpkeys.length - 1) {
                        var request = store.get(tmpkeys[i]);
                        request.onsuccess = function (e) {
                            var re = e.target.result;
                            if (re)
                                res.push(isJSON ? JSON.parse(re.val) : re.val);
                            else
                                res.push(null);
                        };
                    } else {
                        var request = store.get(tmpkeys[i]);
                        request.onsuccess = function (e) {
                            var re = e.target.result;
                            if (re)
                                res.push(isJSON ? JSON.parse(re.val) : re.val);
                            else
                                res.push(null);
                            if (ind == keys.length) {
                                callback(res);
                            } else {
                                _d();
                            }
                        };
                    }
                }

            }
            _d();
        });
    }
    this.clear = function (callback) {
        openDB(function () {
            var transaction = db.transaction(storeName, 'readwrite');
            var store = transaction.objectStore(storeName);
            var request = store.clear();
            request.onsuccess = function (e) {
                if (callback)
                    callback();
            };
        });
    };
}
MyDbIndexedDB.isSupport = function () {
    var result=typeof (window.indexedDB) != 'undefined';
    if(result){
        try{
            var test=new MyDbIndexedDB('_isSupportIndexedDB');
        }catch(error){
            result=false;
        }
    }
    return result;
}
