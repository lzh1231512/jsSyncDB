var uuid = JssDB.tools.uuid;
var clone = JssDB.tools.clone;
var arrayExtend = JssDB.tools.arrayExtend;
var _check = JssDB.tools._check;
var _log = JssDB.tools._log;
var isArray = JssDB.tools.isArray;
var timepiece = JssDB.tools.timepiece;
var ExecQueue = JssDB.tools.ExecQueue;

function LBM(title, path, url) {
    this._temp = JssDB._dbObj;
    this._temp(LOP_idx(), "LBM");
    this.title = title;
    this.path = path;
    if (!url)
        url = null;
    this.url = url;
    return this;
}
JssDB.dbModelIndex['LBM'] = "uuid";
JssDB.dbModelColumn['LBM'] = ['title', 'path', 'url'];
JssDB.dbModelIndexType['LBM'] = "int";

function getBmPath(obj) {
    var path = obj.path;
    if (obj.url) {
        path += "^^url:" + obj.url;
    } else {
        path += obj.title + '/';
    }
    return path;
}
function LOP_idx() {
    var res = baseInfo.get('LOP_idx');
    if (!res)
        res = 0;
    res = parseInt(res);
    baseInfo.set('LOP_idx', res+1);
    return res + 1;
}

function LOP(title, path, action) {
    this._temp = JssDB._dbObj;
    this._temp(uuid(), "LOP");
    this.title = title;
    this.idx = LOP_idx();
    this.path = path;
    this.action = action;
    return this;
}
JssDB.dbModelIndex['LOP'] = "idx";
JssDB.dbModelColumn['LOP'] = ['idx','title', 'path', 'action'];
JssDB.dbModelIndexType['LOP'] = "int";
