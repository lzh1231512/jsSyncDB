var JssDB = JssDB || {};
JssDB.dbModelIndex = JssDB.dbModelIndex||[];
JssDB.dbModelColumn = JssDB.dbModelColumn || [];
JssDB.dbModelIndexType = JssDB.dbModelIndexType||[];
JssDB.dbModelTransformation = JssDB.dbModelTransformation||[];
JssDB.dbModelEvent = JssDB.dbModelEvent|| [];

JssDB._dbObj = function _dbObj(uuid, table) {
    this.uuid = uuid;
    this.table = table;
    return this;
}

/*
function testObj(a,b) {
    this._temp = JssDB._dbObj;
    this._temp(uuid(), "test");
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
*/