/// <reference path="../DB/tools.js" />
/// <reference path="../DB/dbCore.js" />
/// <reference path="tools.js" />

function UnitTestObj(a, b,c) {
    this._temp = _dbObj;
    this._temp(uuid(), "UnitTest");
    this.a = a+'';
    this.b = b;
    this.c = c;
    return this;
}
dbModelIndex['UnitTest'] = "b";
dbModelColumn['UnitTest'] = ['a', 'b', 'c'];
dbModelIndexType['UnitTest'] = "int";
dbModelTransformation['UnitTest'] = {
    viewModelToEntity: function (obj) {
        return obj.a + ',' + obj.b + ',' + obj.c;
    },
    entityToViewModel: function (res) {
        var info = res.split(',');
        return {
            a: info[0],
            b: parseInt(info[1]),
            c: info[2],
        };
    }
}

//	parseInt(100 * Math.random());

function Random(){
    return parseInt(10000000 * Math.random());
}
function checkSort(data) {
    for (var i = 0; i < data.length - 1; i++) {
        if (data[i].b > data[i + 1].b) {
            return false;
        }
    }
    return true;
}
function checkContain(data,key,val) {
    for (var i = 0; i < data.length - 1; i++) {
        if (data[i][key].indexOf(val) == -1) {
            return false;
        }
    }
    return true;
}
function checkStartWith(data, key, val) {
    for (var i = 0; i < data.length - 1; i++) {
        if (data[i][key].indexOf(val) != 0) {
            return false;
        }
    }
    return true;
}
function checkData(data1, data2) {
    if (data1.length != data2.length) {
        return false;
    }
    for (var i = 0; i < data1.length; i++) {
        if (!data2._d().isContain(data1[i], function (item, data) {
            return item.uuid == data.uuid && item.a == data.a && item.b == data.b;
        })) {
            return false;
        }
    }
    return true;
}
(function () {
    var theDB = MyDB.get('UnitTestForCore');
    var clock = new timepiece();
    theDB.clearDB(function () {
        clock.show('1');
        //theDB.dbWriteObj({});
        var lst = [];
        function randomTest(callback) {
            var op = Random() % 3;
            var num = Random() % 100;
            var isDel = [], lst2 = [];
            function test() {
                theDB.dbOpObjs(isDel, lst2, function () {
                    theDB.dbRead("UnitTest", function (objs) {
                        callback(checkSort(objs) && checkData(lst, objs));
                    });
                });
            }
            if (op == 0) {
                for (var i = 0; i < num; i++) {
                    isDel.push(0);
                    var obj = new UnitTestObj(i + 2000, Random(), Random()+'');
                    lst.push(obj);
                    lst2.push(obj);
                }
            } else if (op == 1) {
                for (var i = 0; i < num && i < lst.length; i++) {
                    var theObjind = Random() % lst.length;
                    isDel.push(1);
                    lst2.push(lst.splice(theObjind, 1)[0]);
                }
            } else {
                for (var i = 0; i < num && i < lst.length; i++) {
                    var theObjind = Random() % lst.length;
                    isDel.push(0);
                    var theObj = lst[theObjind];
                    theObj.a = i;
                    theObj.b = Random();
                    lst2.push(theObj);
                }
            }
            test();
        }
        var isDel = [], lst2 = [];
        for (var i = 0; i < 500; i++) {
            isDel.push(0);
            var obj = new UnitTestObj(i + 2000, Random(), Random() + '');
            lst.push(obj);
            lst2.push(obj);
        }
        theDB.dbOpObjs(isDel, lst2, function () {
            for (var i = 0; i < 100; i++) {
                var obj = new UnitTestObj(i, Random(), Random() + '');
                theDB.dbWriteObj(obj, i != 99 ? null : function () {
                    isDel = [], lst2 = [];
                    for (var i = 0; i < 1600; i++) {
                        isDel.push(0);
                        var obj = new UnitTestObj(i + 20000, Random(), Random() + '');
                        lst.push(obj);
                        lst2.push(obj);
                    }
                    theDB.dbOpObjs(isDel, lst2, function () {
                        theDB.dbRead("UnitTest", function (objs) {
                            _check(checkSort(objs), 'data sort');
                            _check(checkData(lst, objs), 'dbWriteObj,dbOpObjs,dbRead');
                            theDB.dbRead("UnitTest", [['c', 'con', '1']], function (objs) {
                                _check(checkContain(objs, 'c', '1'), 'Contain 1');
                                theDB.dbRead("UnitTest", ['a', 'con', '12'], function (objs) {
                                    _check(checkContain(objs, 'a', '12'), 'Contain 2');

                                    theDB.dbRead("UnitTest", ['a', 'sw', '1'], function (objs) {
                                        _check(checkStartWith(objs, 'a', '1'), 'StartWith');


                                        clock.show('2');
                                        var jsq = 0;
                                        function rt(r) {
                                            if (r) {
                                                if (jsq < 100) {
                                                    randomTest(rt);
                                                } else {
                                                    _check(1, 'randomTest');
                                                    clock.show('3');
                                                }
                                            } else {
                                                _check(0, 'randomTest');
                                                clock.show('3');
                                            }
                                            jsq++;
                                        }
                                        randomTest(rt);
                                    });

                                    

                                });
                                

                            });
                        });
                    });
                });
                lst.push(obj);
            }
        });
    });
})();