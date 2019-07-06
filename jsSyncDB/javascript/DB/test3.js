/// <reference path="dbSync.js" />
var mySyncDB = new JssDB('testuser', 'testdb3', 'http://localhost:50939/');

function testObj(a, b) {
    this._temp = JssDB._dbObj;
    this._temp(JssDB.tools.uuid(), "test");
    this.a = a;
    this.b = b;
    var dt = new Date(2017, 5, 13, 20, 0, 0);
    this.c = (new Date()).getTime() - dt.getTime();
    return this;
}
JssDB.dbModelIndex['test'] = "c";//order by c
JssDB.dbModelColumn['test'] = ['a', 'b', 'c'];
JssDB.dbModelIndexType['test'] = "int";
JssDB.dbModelTransformation['test'] = {
    viewModelToEntity: function (obj) {
        return obj.a + ',' + obj.b + ',' + obj.c;
    },
    entityToViewModel: function (res) {
        var info = res.split(',');
        return {
            a: info[0],
            b: info[1],
            c: parseInt(info[2])
        };
    }
}
JssDB.dbModelEvent['test'] = {
    onSave: function (theOld, thenew) {

    }, onDelete: function (theOld) {

    }
}

var test = JSON.stringify(null);
var test2 = JSON.parse(test);
mySyncDB.clear(function () {
    //var obj1 = new testObj(11, 2);
    //var obj2 = new testObj(21, 4);
    //var obj3 = new testObj(31, 9);
    var isDel = []; var objs = [];
    console.log('begin insert');
    for (var i = 0; i < 10; i++) {
        objs.push(new testObj(i + '123', 9));
        isDel.push(0);
    }
    mySyncDB.opObj(isDel, objs, function () {
        console.log('inserted');
    });
    mySyncDB.autoSync(function (r) {
        console.log(r);
    });
});




    /*
    mySyncDB.writeObj(obj1, function () {
        mySyncDB.writeObj(obj2, function () {
            mySyncDB.writeObj(obj3, function () {
                console.log('testetet');
            });
        });
    });
    */


    //mySyncDB.sync(function (r) {
    //    console.log(r);
    //});
    //var res = mySyncDB.dbRead('test');
    //for (var i = 0; i < res.length; i++) {
    //    console.log("test1 " + res[i].a + " " + res[i].b + " " + res[i].c);
    //}
    //mySyncDB.clearUUID();
    //mySyncDB.autoSync(10,function (r) {
    //    console.log(r);  
    //});