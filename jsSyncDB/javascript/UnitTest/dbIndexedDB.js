/// <reference path="../DB/base/dbIndexedDB.js" />
/// <reference path="../DB/tools.js" />
(function () {
    var db = new MyDbIndexedDB('MyDbIndexedDB');
    db.clear(function () {
        var key = 'key', val = 'val';
        var key2 = 'key2', val2 = 'val2';
        var key3 = 'key3', val3 = 'val3';

        var cmd = [];
        db.addCmd(key, val, cmd);
        db.addCmd(key2, val2, cmd);
        db.addCmd(key3, val3, cmd);
        db.exec(cmd, function () {
            var keys = [key, key2, key3];
            db.getVals(keys, 0, function (vals) {
                _check(val == vals[0] && val2 == vals[1] && val3 == vals[2], "read wirte");
                cmd = [];
                db.delCmd(key2, cmd);
                db.exec(cmd, function () {
                    var keys = [key, key2, key3];
                    db.getVals(keys, 0, function (vals) {
                        _check(val == vals[0] && !vals[1] && val3 == vals[2], "delete");
                    });
                });
            });
        });
    });
})();