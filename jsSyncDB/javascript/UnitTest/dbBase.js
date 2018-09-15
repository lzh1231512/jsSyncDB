/// <reference path="../DB/tools.js" />
/// <reference path="../DB/dbBase.js" />
(function () {
    var db = MyBaseDB.get('MyBaseDB');

    var key0 = 'key', val0 = null;
    var v0 = db.get(key0);
    _check(v0 == val0, 'MyBaseDB get,set null 0');
    db.set(key0, val0);
    v0 = db.get(key0);
    _check(v0 == val0, 'MyBaseDB get,set null 1');


    var key = 'key', val = 'val';
    db.set(key, val);
    var v = db.get(key);
    _check(v == val, 'MyBaseDB get,set');
    db.set(key);
    v = db.get(key);
    _check(!v, 'MyBaseDB del');

    var key2 = 'key2', val2 = { a: 1, b: 2, c: 3 };
    db.set(key2, val2);
    var v = db.get(key2,1);
    _check(v && v.a == 1 && v.b == 2 && v.c == 3, 'MyBaseDB get,set json');

    var key3 = 'key3', val3 = 'val3';
    db.set(key3, val3);
    db.clear();
    var v1 = db.get(key2), v2 = db.get(key3);
    _check(!v1 && !v2, 'MyBaseDB clear');

    db.setDB(key, val, function () {
        db.getDB(key, 0, function (v) {
            _check(v == val, 'setDB,getDB');
            db.setDB(key, function () {
                db.getDB(key, 0, function (v) {
                    _check(!v, 'deleteDB');
                });
            });
        });
    });

    db.setDB(key2, val2, function () {
        db.getDB(key2, 1, function (v) {
            _check(v && v.a == 1 && v.b == 2 && v.c == 3, 'setDB obj,getDB obj');
        });
    });

    var lst = [];
    var lst3 = [];
    var keys = [];
    var cmds = [];
    for (var i = 0; i < 1000; i++) {
        var obj = {
            a: i,
            b: Math.random()
        }
        lst.push(obj);
        lst3.push(obj);
        keys.push('s' + i);
        db.setDBcmd('s' + i, obj, cmds);
    }
    db.setDB(cmds, function () {
        db.getDB( keys,1, function (vals) {
            var check = true;
            check = check && vals.length == lst.length;
            for (var i = 0; i < lst.length; i++) {
                check = check && vals[i].a == lst[i].a;
                check = check && vals[i].b == lst[i].b;
            }
            _check(check, 'setDB objs,getDB objs');

            cmds = [];
            db.setDBcmd('s111', cmds);
            db.setDB(cmds, function () {
                db.getDB(keys,1, function (vals) {
                    var check = true;
                    check = check && vals.length == lst.length;
                    for (var i = 0; i < lst.length; i++) {
                        if (i != 111) {
                            check = check && vals[i].a == lst[i].a;
                            check = check && vals[i].b == lst[i].b;
                        } else {
                            check = check && !vals[i];
                        }
                    }
                    _check(check, 'delDB objs');
                    db.clear(function () {
                        db.getDB(keys,1, function (vals) {
                            var check = true;
                            for (var i = 0; i < lst.length; i++) {
                                check = check && !vals[i];
                            }
                            _check(check, 'clear');
                        });
                    });
                });
            });

        });
    });
})();