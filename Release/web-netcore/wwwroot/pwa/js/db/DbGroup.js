function DbGroup() {
    this.method = baseDb;
    var res = this.method(DbGroup.def);
    delete this.method;
    res.table = "DbGroup";
    return res;
}
JssDB.dbModelIndex['DbGroup'] = "name";//order by c
JssDB.dbModelColumn['DbGroup'] = ['name', 'status'];
JssDB.dbModelIndexType['DbGroup'] = "string";
DbGroup.tableName = 'DbGroup';
DbGroup.tmpData = [];
DbGroup.def = [
    ['name', 1],
    ['uuid'],
    ['status', 0, -99]
];
DbGroup.syncflag = true;
baseDb.initDB(DbGroup);
DbGroup.select = function (status,callback) {
    var cs = {};
    if (status == 1) {
        cs.status = '1';
    }
    DbGroup.baseSelect(cs, "name", callback);
}
DbGroup.selectWithDecrypt = function (status, key, callback) {
    var cs = {};
    if (status == 1) {
        cs.status = '1';
    }
    return DbGroup.baseSelectWithDecrypt(cs, "name", key, null, callback);
}
