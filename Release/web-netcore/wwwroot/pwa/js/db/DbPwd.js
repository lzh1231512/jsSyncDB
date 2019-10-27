function DbPwd() {
    this.method = baseDb;
    var res = this.method(DbPwd.def);
    delete this.method;
    res.table = "DbPwd";
    return res;
}
JssDB.dbModelIndex['DbPwd'] = "pUUID";//order by c
JssDB.dbModelColumn['DbPwd'] = ['pUUID', 'pwd', 'xh', 'createTime'];
JssDB.dbModelIndexType['DbPwd'] = "string";
DbPwd.tableName = 'DbPwd';
DbPwd.tmpData = [];
DbPwd.def = [
    ['pUUID'],
    ['uuid'],
    ['pwd', 1],
    ['xh', 0, -99],
    ['createTime', 0, function () { return (new Date()).getTime() }]
];
DbPwd.syncflag = true;
baseDb.initDB(DbPwd);
DbPwd.select = function (pUUID,order,callback) {
    var cs = {};
    if (pUUID) {
        cs.pUUID = pUUID;
    }
    DbPwd.baseSelect(cs, "xh " + order,callback);
}
DbPwd.delByPUUID=function(pUUID,callback){
    DbPwd.select(pUUID,null, function (lst) {
        function _d() {
            if (lst.length > 0) {
                var obj = lst.shift();
                DbPwd.del(obj.uuid, _d);
            } else {
                callback();
            }
        }
        _d();
    });
	
}
DbPwd.selectWithDecrypt = function (pUUID, order, key, callback) {
    var cs = {};
    if (pUUID) {
        cs.pUUID = pUUID;
    }
    DbPwd.baseSelectWithDecrypt(cs, "xh " + order, key, null, callback);
}