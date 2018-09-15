function MyDbSqlite(dbName) {
    var DbName = dbName;
    var _t_main = "create table if not exists t_main(pkey varchar(100) primary key,pvalue TEXT);";
    var dbObj = {};
    function _getSqliteDatabase() {
        if (dbObj[DbName])
            return dbObj[DbName];
        var _dataBase = openDatabase(DbName, "1.0", DbName, 10 * 1024 * 1024, function () { });
        _dataBase.transaction(function (tx) {
            tx.executeSql(
            _t_main,
            [],
            function (tx, result) { },
            function (tx, error) {
            });
        });
        dbObj[DbName] = _dataBase;
        return _dataBase;
    }
    function sqliteDelCmd(key, sqlCMD) {
        sqlCMD.push({
            sql: "delete from t_main where pkey=?;",
            para: ['' + key]
        });
    }
    function sqliteAddCmd(key, val, sqlCMD) {
        sqlCMD.push({
            sql: "insert into t_main(pkey,pvalue) values(?,?);",
            para: ['' + key, val]
        });
    }
    function execSqliteCMD(sqlCMD,theCache2, callback) {
        var _dataBase = _getSqliteDatabase();
        _dataBase.transaction(function (tx) {
            for (var i = 0; i < sqlCMD.length; i++) {
                var cmd = sqlCMD[i];
                theCache2.set(cmd.para[0], cmd.para[1]);
                if (i != sqlCMD.length - 1) {
                    tx.executeSql(
                    cmd.sql,
                    cmd.para,
                    function (tx, result) {
                    },
                    function (tx, error) {
                        console.log(error);
                    });
                } else {
                    tx.executeSql(
                    cmd.sql,
                    cmd.para,
                    callback,
                    function (tx, error) {
                        console.log(error);
                    });
                }
            }
        });
    }
    function getValsFromSqlite(keys, isJSON, callback) {
        var _dataBase = _getSqliteDatabase();
        var res = [];
        var ind = 0;
        function _d() {
            var p = '';
            var tmpkeys = [];
            for (var i = 0; i < 100 && ind < keys.length; i++, ind++) {
                if (i != 0)
                    p += ',';
                p += '\'' + keys[ind] + "\'";
                tmpkeys.push(keys[ind]);
            }
            _dataBase.transaction(function (tx) {
                tx.executeSql(
                    "select pvalue val,pkey key from t_main where pkey in (" + p + ");",
                    [],
                    function (tx, result) {
                        var temp = [];
                        for (var j = 0; j < result.rows.length; j++) {
                            temp.push(result.rows.item(j));
                        }
                        for (var i = 0; i < tmpkeys.length; i++) {
                            var obj = null;
                            for (var j = 0; j < temp.length; j++) {
                                if (temp[j].key == tmpkeys[i]) {
                                    if (!isJSON)
                                        obj = temp[j].val;
                                    else
                                        obj = JSON.parse(temp[j].val);
                                    temp.splice(j, 1);
                                    break;
                                }
                            }
                            res.push(obj);
                        }
                        if (ind == keys.length) {
                            callback(res);
                        } else {
                            _d();
                        }
                    },
                    function (tx, error) {
                        console.log(error);
                    });
            });

        }
        _d();
    }
    function localClearFromSqlite(callback) {
        var _dataBase = _getSqliteDatabase();
        _dataBase.transaction(function (tx) {
            tx.executeSql(
                "drop table t_main;",
                [],
                function (tx, result) {
                },
                function (tx, error) {
                    console.log(error);
                });
            tx.executeSql(
            _t_main,
            [],
            callback,
            function (tx, error) {
                console.log(error);
            });
        });
    }

    this.delCmd = sqliteDelCmd;
    this.addCmd = sqliteAddCmd;
    this.exec = execSqliteCMD;
    this.getVals = getValsFromSqlite;
    this.clear = localClearFromSqlite;
}
MyDbSqlite.isSupport = function () {
    var result=typeof (openDatabase) != 'undefined';
    if(result){
        try{
            var test = new MyDbSqlite('_isSupportSqlite');
        }catch(error){
            result=false;
        }
    }
    return result;
}
