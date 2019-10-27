function DbConn() {
    this.method = baseDb;
    var res = this.method(DbConn.def);
    delete this.method;
    res.table = "DbConn";
    return res;
}
JssDB.dbModelIndex['DbConn'] = "title";//order by c
JssDB.dbModelColumn['DbConn'] = ['title', 'lx', 'dz', 'txmy', 'code', 'state'];
JssDB.dbModelIndexType['DbConn'] = "string";
DbConn.tableName = 'DbConn';
DbConn.tmpData = [];
DbConn.def = [
    ['uuid'],
    ['title'],
    ['lx'],
    ['dz'],
    ['txmy'],
    ['code'],
    ['state']
];
DbConn.syncflag = false;
baseDb.initDB(DbConn);
DbConn.select = function (callback) {
    DbConn.baseSelect(null,null,callback);
}
