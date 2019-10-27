function DbAc() {
    this.method = baseDb;
    var res = this.method(DbAc.def);
    delete this.method;
    res.table = "DbAc";
    return res;
}
JssDB.dbModelIndex['DbAc'] = "title";//order by c
JssDB.dbModelColumn['DbAc'] = ['title', 'groupId', 'uid', 'eMail', 'summary', 'url', 'createTime', 'updateTime', 'status','F2A'];
JssDB.dbModelIndexType['DbAc'] = "string";

DbAc.tableName = 'DbAc';
DbAc.tmpData = [];
DbAc.def = [
    ['title', 1],
    ['groupId'],
    ['uuid'],
    ['uid', 1],
    ['eMail', 1],
    ['summary', 1],
    ['url', 1],
    ['createTime', 0, function () { return (new Date()).getTime() }],
    ['updateTime', 0, function () { return (new Date()).getTime() }],
    ['status', 0, -99],
    ['F2A',1]
];
DbAc.syncflag = true;
baseDb.initDB(DbAc);
DbAc.select = function (groupId, status,callback) {
    var cs = {};
    if (groupId) {
        cs.groupId = groupId;
    }
    if (status == 1) {
        cs.status = '1';
    } else if (status==0) {
        cs.status = '1,0';
    }
    DbAc.baseSelect(cs, "title", callback);
}
DbAc.selectWithDecrypt = function (groupId, status, key, DecryptLst, callback) {
    var cs = {};
    if (groupId) {
        cs.groupId = groupId;
    }
    if (status == 1) {
        cs.status = '1';
    } else if (status == 0) {
        cs.status = '1,0';
    }
    DbAc.baseSelectWithDecrypt(cs, "title", key, DecryptLst, callback);
}