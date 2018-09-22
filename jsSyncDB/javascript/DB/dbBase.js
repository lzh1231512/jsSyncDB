
var JssDB = JssDB || {};
JssDB.dbBase = (function () {
    var uuid = JssDB.tools.uuid;
    var clone = JssDB.tools.clone;
    var arrayExtend = JssDB.tools.arrayExtend;
    var _check = JssDB.tools._check;
    var _log = JssDB.tools._log;
    var isArray = JssDB.tools.isArray;
    var timepiece = JssDB.tools.timepiece;
    var ExecQueue = JssDB.tools.ExecQueue;
    var dbCache = JssDB.dbCache;

    function MyBaseDB(dbName, dbType) {
        
        var DbName = dbName;
        var db;
        var theCache = new dbCache();
        var theCache2 = new dbCache(10 * 1024 * 1024);
        if (!dbType) {
            dbType = get('dbtype');
        }
        if (dbType) {
            if (JssDB.dbBase[dbType] && JssDB.dbBase[dbType].isSupport()) {
                db = new JssDB.dbBase[dbType](dbName);
                _log('using ' + JssDB.dbBase[dbType].dbname);
            }
        }

        if (!db) {
            var p = 0, d;
            for (var i in JssDB.dbBase) {
                if (typeof (JssDB.dbBase[i].isSupport) == "function" && JssDB.dbBase[i].isSupport() && JssDB.dbBase[i].priority > p) {
                    p = JssDB.dbBase[i].priority;
                    d = JssDB.dbBase[i];
                }
            }
            if (d) {
                db = new d(dbName);
                _log('using ' + d.dbname);
            } else {
                _log('No support any local database');
                return;
            }
        }



        function getkey(k) {
            return DbName + '.' + k;
        }
        function get(key, isJSON) {
            if (theCache.exists(key)) {
                var res = theCache.get(key);
            } else {
                var res = localStorage.getItem(getkey(key));
                theCache.set(key, res);
            }
            if (isJSON && res)
                res = JSON.parse(res);
            return res;
        }
        function set(key, val) {
            if (typeof (val) != 'undefined') {
                if (typeof (val) == 'object' && val !== null)
                    val = JSON.stringify(val);
                else if (val !== null)
                    val = val + '';
                theCache.set(key, val);
                if (val === null)
                    localStorage.removeItem(getkey(key));
                else
                    localStorage.setItem(getkey(key), val);
            } else {
                theCache.set(key);
                localStorage.removeItem(getkey(key));
            }
        }
        function clear(callback) {
            var removekeys = [];
            for (var i = 0, len = localStorage.length; i < len; i++) {
                var key = localStorage.key(i);
                if (key.indexOf(DbName + ".") == 0) {
                    removekeys.push(key);
                }
            }
            for (var i = 0; i < removekeys.length; i++) {
                localStorage.removeItem(removekeys[i]);
            }
            theCache.clear();
            theCache2.clear();
            db.clear(callback);
        }
        function getDB(key, isJSON, callback) {
            var isLst = isArray(key);
            if (!isLst)
                key = [key];
            var res = [];
            var dbkey = [];
            var dbkeyIndex = [];
            for (var i = 0; i < key.length; i++) {
                if (theCache2.exists(key[i])) {
                    var val = theCache2.get(key[i]);
                    if (val && isJSON)
                        val = JSON.parse(val);
                    res.push(val);
                } else {
                    dbkey.push(key[i]);
                    dbkeyIndex.push(i);
                    res.push(null);
                }
            }
            function _d(dbData) {
                for (var i = 0; i < dbData.length; i++) {
                    res[dbkeyIndex[i]] = dbData[i];
                }
                if (!isLst) {
                    return callback(res[0]);
                } else {
                    return callback(res);
                }
            }
            if (dbkey.length) {
                db.getVals(dbkey, isJSON, _d);
            } else {
                setTimeout(function () {
                    _d([]);
                }, 0);
            }
        }
        function setDB(key, val, callback) {
            if (!isArray(key)) {
                var sqlcmd = [];
                if (typeof (val) != 'function')
                    setDBcmd(key, val, sqlcmd);
                else
                    setDBcmd(key, sqlcmd);
            } else {
                var sqlcmd = key;
            }
            if (typeof (callback) == 'undefined') {
                callback = val;
            }
            if (!callback)
                callback = function () { }
            db.exec(sqlcmd, theCache2, callback);
        }
        function setDBcmd(key, val, sqlCMD) {
            var isdel = false;
            if (typeof (sqlCMD) == 'undefined') {
                sqlCMD = val;
                isdel = true;
            }
            db.delCmd(key, sqlCMD);
            if (!isdel) {
                if (typeof (val) == 'object')
                    val = JSON.stringify(val);
                else if (val)
                    val = val + '';
                db.addCmd(key, val, sqlCMD);
            }
        }

        this.get = get;
        this.set = set;
        this.setDB = setDB;
        this.setDBcmd = setDBcmd;
        this.getDB = getDB;
        this.clear = clear;
    }
    var _MyBaseDBs = [];
    MyBaseDB.get = function (dbName, dbType) {
        if (_MyBaseDBs[dbName])
            return _MyBaseDBs[dbName];
        _MyBaseDBs[dbName] = new MyBaseDB(dbName, dbType);
        return _MyBaseDBs[dbName];
    }

    return MyBaseDB;
})();