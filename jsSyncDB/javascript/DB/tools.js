var JssDB = JssDB || {};
JssDB.tools = (function () {
    var BASE64_MAPPING = [
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
        'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
        'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
        'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
        'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
        'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
        'w', 'x', 'y', 'z', '0', '1', '2', '3',
        '4', '5', '6', '7', '8', '9', '+', '/'
    ];
    function uuid() {
        var s = [];
        var hexDigits = "0123456789abcdef";
        for (var i = 0; i < 36; i++) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
        s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
        s[8] = s[13] = s[18] = s[23] = "";//-

        var guid = s.join("");
        var binaryArray = [];
        for (var i = 0; i < 16; i++) {
            var j = i;
            if (i < 4) {
                j = 3 - i;
            } else if (i < 6) {
                j = 9 - i;
            } else if (i < 8) {
                j = 13 - i;
            }
            var d = parseInt(guid.substr(j * 2, 2), 16);
            binaryArray.push(d);
        }
        var base64 = '';
        for (var i = 0; i < binaryArray.length; i += 3) {
            var x = binaryArray[i] + 1;
            if (i + 1 < binaryArray.length) {
                x *= (binaryArray[i + 1] + 1);
            }
            if (i + 2 < binaryArray.length) {
                x *= (binaryArray[i + 2] + 1);
            }
            base64 += BASE64_MAPPING[(x % 64)];
            x = parseInt(x / 64);
            base64 += BASE64_MAPPING[(x % 64)];
            if (i < 15) {
                x = parseInt(x / 64);
                base64 += BASE64_MAPPING[(x % 64)];
                x = parseInt(x / 64);
                base64 += BASE64_MAPPING[(x)];
            }
        }

        return base64;
    }

    function clone(obj) {
        var val = JSON.stringify(obj);
        return JSON.parse(val);
    }

    function arrayExtend(lst) {
        this.lst = lst;
        return this;
    }
    if (!Array.prototype._d) {
        Array.prototype._d = function () {
            return new arrayExtend(this);
        };
    }
    if (!arrayExtend.prototype.isContain) {
        arrayExtend.prototype.isContain = function (val, compareFunc) {
            if (typeof (val) == 'function') {
                compareFunc = val;
                val = null;
            }
            var lst = this.lst;
            for (var i = 0; i < lst.length; i++) {
                if (compareFunc) {
                    if (compareFunc.apply(lst[i], [lst[i], val]))
                        return true;
                } else if (lst[i] == val) {
                    return true;
                }
            }
            return false;
        }
    }
    if (!arrayExtend.prototype.remove) {
        arrayExtend.prototype.remove = function (val, compareFunc) {
            var lst = this.lst;
            for (var i = 0; i < lst.length; i++) {
                if (compareFunc) {
                    if (compareFunc.apply(lst[i], [lst[i], val])) {
                        lst.splice(i, 1);
                        return true;
                    }
                } else {
                    if (lst[i] == val) {
                        lst.splice(i, 1);
                        return true;
                    }
                }
            }
            return false;
        }
    }
    if (!arrayExtend.prototype.filter) {
        arrayExtend.prototype.filter = function (filterFunc) {
            var res = [];
            var lst = this.lst;
            for (var i = 0; i < lst.length; i++) {
                if (filterFunc.apply(lst[i], [lst[i], i]))
                    res.push(lst[i]);
            }
            return res;
        }
    }

    function _check(check, func) {
        if (check)
            console.log(func + ' check:pass');
        else
            console.error(func + ' check:failed');
        return check;
    }
    function _log(log) {
        if (console)
            console.log(log);
    }
    function isArray(o) {
        return Object.prototype.toString.call(o) == '[object Array]';
    }

    function timepiece() {
        var dt = new Date();
        this.reset = function () {
            dt = new Date();
        }
        this.check = function () {
            var dt2 = new Date();
            return ((dt2.getTime() - dt.getTime()) * 1.0) / 1000;
        }
        this.show = function (msg) {
            var res = this.check();
            console.log('time spent: ' + res + 's ' + (msg || ''));
        }
        return this;
    }

    function ExecQueue() {
        this.locked = 0;
        var base = this;
        var queue = [];
        this.lock = function () {
            base.locked = 1;
        }
        this.push = function (fun, args) {
            queue.push([fun, args]);
        }
        this.release = function () {
            base.locked = 0;
            if (queue.length) {
                var info = queue.shift();
                info[0].apply(this, info[1]);
            }
        }
        this.fixCallBack = function (callback) {
            return function () {
                setTimeout(function () {
                    base.locked = 0;
                    if (queue.length) {
                        var info = queue.shift();
                        info[0].apply(this, info[1]);
                    }
                }, 0);
                if (callback)
                    callback.apply(this, arguments);
            };
        }
    }

    return {
        uuid: uuid,
        clone: clone,
        arrayExtend: arrayExtend,
        _check: _check,
        _log: _log,
        isArray: isArray,
        timepiece: timepiece,
        ExecQueue: ExecQueue,
        toGlobal: function (fun) {
            fun.uuid = uuid;
            fun.clone = clone;
            fun.arrayExtend = arrayExtend;
            fun._check = _check;
            fun._log = _log;
            fun.isArray = isArray;
            fun.timepiece = timepiece;
            fun.ExecQueue = ExecQueue;
        }
    };
})();