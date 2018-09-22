var JssDB = JssDB || {};
JssDB.dbCache = function dbCache(limit) {
    var uuid = JssDB.tools.uuid;
    var clone = JssDB.tools.clone;
    var arrayExtend = JssDB.tools.arrayExtend;
    var _check = JssDB.tools._check;
    var _log = JssDB.tools._log;
    var isArray = JssDB.tools.isArray;
    var timepiece = JssDB.tools.timepiece;
    var ExecQueue = JssDB.tools.ExecQueue;

    this.limit = limit;
    var theCache = {}
    var theCacheCheck = {}
    var keys = [];
    var keysIterator = keys._d();
    this.length = 0;
    this.exists = function (key) {
        key += '';
        return !!theCacheCheck[key];
    }
    this.clear = function () {
        keys = [];
        keysIterator = keys._d();
        theCache = {}
        theCacheCheck = {}
        this.length = 0;
    }
    this.get = function (key) {
        key = key + '';
        if (typeof (theCache[key]) == 'undefined') {
            return null;
        }
        return theCache[key];
    }
    this.set = function (key, val) {
        key = key + '';
        if (!keysIterator.isContain(key)) {
            keys.push(key);
        }
        if (typeof (val) == 'undefined') {
            val = null;
        }
        if (this.limit) {
            var old = theCache[key];
            var oldlength = old ? old.length : 0;
            var newlength = val ? val.length : 0;
            this.length += newlength - oldlength;
        }
        theCache[key] = val;
        theCacheCheck[key] = 1;
        if (this.limit && this.length > this.limit) {
            var newlimit = this.limit * 0.7;
            while (this.length > newlimit) {
                var delkey = keys.shift();
                delete theCacheCheck[delkey];
                var val = theCache[delkey];
                if (val) {
                    this.length -= val.length;
                }
                delete theCache[delkey];
            }
        }
    }
}