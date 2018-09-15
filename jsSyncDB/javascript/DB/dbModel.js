var dbModelIndex = [];
var dbModelColumn = [];
var dbModelIndexType = [];
var dbModelTransformation = [];
var dbModelEvent = [];
function _dbObj(uuid, table) {
    this.uuid = uuid;
    this.table = table;
    return this;
}
//dbModelIndex['_dbObj'] = "uuid"; //order by uuid
function testObj(a,b) {
    this._temp = _dbObj;
    this._temp(uuid(), "test");
    this.a = a;
    this.b = b;
    var dt = new Date(2017, 5, 13, 20, 0, 0);
    this.c = (new Date()).getTime() - dt.getTime();
    return this;
}
dbModelIndex['test'] = "c";//order by c
dbModelColumn['test'] = ['a', 'b', 'c'];
dbModelIndexType['test'] = "int";
dbModelTransformation['test'] = {
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
dbModelEvent['test'] = {
    onSave: function (theOld, thenew) {

    }, onDelete: function (theOld) {

    }
}