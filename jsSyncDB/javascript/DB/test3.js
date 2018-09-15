/// <reference path="dbSync.js" />
var mySyncDB = new MySyncDB('testuser', 'testdb1', 'http://localhost:8080/BookMarksSync');
var test = JSON.stringify(null);
var test2 = JSON.parse(test);
mySyncDB.clear(function () {
    //var obj1 = new testObj(11, 2);
    //var obj2 = new testObj(21, 4);
    //var obj3 = new testObj(31, 9);
    var isDel = []; var objs = [];
    console.log('begin insert');
    for (var i = 0; i < 100; i++) {
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