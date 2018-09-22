var JssDB = JssDB || {};
JssDB.dbBase = JssDB.dbBase || {};
JssDB.dbBase.LocalStorage = (function () {
    var uuid = JssDB.tools.uuid;
    var clone = JssDB.tools.clone;
    var arrayExtend = JssDB.tools.arrayExtend;
    var _check = JssDB.tools._check;
    var _log = JssDB.tools._log;
    var isArray = JssDB.tools.isArray;
    var timepiece = JssDB.tools.timepiece;
    var ExecQueue = JssDB.tools.ExecQueue;
    function MyDbLocalStorage(dbName) {
        var DbName = dbName;
        function getkey(k) {
            return DbName + '.' + k;
        }
        function get(key, isJSON) {
            var res = localStorage.getItem(getkey(key));
            if (isJSON && res)
                res = JSON.parse(res);
            return res;
        }
        function set(key, val) {
            if (typeof (val) != 'string')
                val = JSON.stringify(val);
            if (typeof (val) != 'undefined')
                localStorage.setItem(getkey(key), val);
            else
                localStorage.removeItem(getkey(key));
        }

        this.delCmd = function (key, sqlCMD) {
            sqlCMD.push({ ac: 'del', key: key });
        }
        this.addCmd = function (key, val, sqlCMD) {
            sqlCMD.push({ ac: 'set', key: key, val: val });
        }
        this.exec = function (sqlCMD, theCache2, callback) {
            for (var i = 0; i < sqlCMD.length; i++) {
                var cmd = sqlCMD[i];
                if (cmd.ac == 'del') {
                    set(cmd.key);
                } else {
                    set(cmd.key, cmd.val);
                }
                theCache2.set(cmd.key, cmd.val);
            }
            callback();
        }
        this.getVals = function (keys, isJSON, callback) {
            var res = [];
            for (var i = 0; i < keys.length; i++) {
                var val = get(keys[i], isJSON);
                res.push(val);
            }
            callback(res);
        }
        this.clear = function (callback) {
            if (callback)
                callback();
        };
    }
    MyDbLocalStorage.dbname = "LocalStorage";
    MyDbLocalStorage.priority = 1;
    MyDbLocalStorage.isSupport = function () {
        return typeof (localStorage) != 'undefined';
    }
    return MyDbLocalStorage;
})();