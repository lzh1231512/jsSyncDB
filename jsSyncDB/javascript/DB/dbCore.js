var JssDB = JssDB || {};
JssDB.dbCode = JssDB.dbCode || (function () {
    var uuid = JssDB.tools.uuid;
    var clone = JssDB.tools.clone;
    var arrayExtend = JssDB.tools.arrayExtend;
    var _check = JssDB.tools._check;
    var _log = JssDB.tools._log;
    var isArray = JssDB.tools.isArray;
    var timepiece = JssDB.tools.timepiece;
    var ExecQueue = JssDB.tools.ExecQueue;

    var dbModelIndex = JssDB.dbModelIndex;
    var dbModelColumn = JssDB.dbModelColumn;
    var dbModelIndexType = JssDB.dbModelIndexType;
    var dbModelTransformation = JssDB.dbModelTransformation;
    var dbModelEvent = JssDB.dbModelEvent;

    function MyTable(db, tableName) {
        this.dbRead = function (filters, skip, take, callback) {
            db.dbRead(tableName, filters, skip, take, callback);
        }
        return this;
    }
    function MyDB(dbName, dbType) {
        var DbName = dbName;
        var indexLimit = 200;
        var db = JssDB.dbBase.get(dbName, dbType);
        var queue = new ExecQueue();
        function clearDB(callback) {
            db.clear(callback);
        }
        function identity() {
            var res = db.get('identity');
            if (!res)
                res = 1;
            res = parseInt(res);
            db.set('identity', res + 1);
            return res;
        }
        function indexIdentity(re) {
            var indexidentityRe = db.get('indexidentityRe', 1) || [];
            if (re) {
                indexidentityRe.push(re);
                db.set('indexidentityRe', indexidentityRe);
                return;
            }
            if (indexidentityRe.length) {
                var res = indexidentityRe[0];
                indexidentityRe.splice(0, 1);
                db.set('indexidentityRe', indexidentityRe);
                return res;
            }
            var res = db.get('indexidentity');
            if (!res)
                res = 1;
            res = parseInt(res);
            db.set('indexidentity', res + 1);
            return res;
        }
        function tableIndex(tableName) {
            var res = db.get('tableName.' + tableName);
            if (res) {
                return parseInt(res);
            }
            res = db.get('tableIndexIdentity');
            if (!res)
                res = 1;
            res = parseInt(res);
            db.set('tableIndexIdentity', res + 1);
            db.set('tableName.' + tableName, res);
            db.set('tableIndex.' + res, tableName);
            return res;
        }
        function tableName(tableIndex) {
            var res = db.get('tableIndex.' + tableIndex);
            return res;
        }
        function getChar(ind) {
            var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            if (ind < 52) {
                return chars.charAt(ind);
            } else {
                return chars.charAt(ind / 52) + chars.charAt(ind % 52);
            }
        }
        function viewModelToEntity(obj) {
            if (dbModelTransformation[obj.table]) {
                var res = tableIndex(obj.table) + ',' + dbModelTransformation[obj.table].viewModelToEntity(obj);
                return res;
            }
            if (obj.uuid && obj.table) {
                var obj2 = {};
                //obj2.a = obj.uuid;
                obj2.b = tableIndex(obj.table);
                for (var j = 0; j < dbModelColumn[obj.table].length; j++) {
                    var co = dbModelColumn[obj.table][j];
                    obj2[getChar(j + 2)] = obj[co];
                }
                return obj2;
            }
            return null;
        }
        function entityToViewModel(res, uuid) {
            if (!res) {
                return null;
            }
            var a = res.indexOf(',');
            if (a > 0) {
                var b = res.substr(0, a);
                var n = Number(b);
                if (!isNaN(n)) {
                    var table = tableName(b);
                    var res2 = dbModelTransformation[table].entityToViewModel(res.substr(a + 1));
                    res2.uuid = uuid;
                    res2.table = table;
                    return res2;
                }
            }
            res = JSON.parse(res);
            if (res.b) {
                var res2 = {
                    uuid: uuid,
                    table: tableName(res.b)
                };
                for (var i = 0; i < dbModelColumn[res2.table].length; i++) {
                    var co = dbModelColumn[res2.table][i];
                    res2[co] = res[getChar(i + 2)];
                }
                return res2;
            }
            return null;
        }
        var _isWriting = 0;
        function checkFormat(obj) {
            return !!(obj && obj.uuid && obj.table && dbModelColumn[obj.table]);
        }

        var _dbOpObjsTemp = [];
        var _dbOpObjsTemp2 = [];
        function dbOpObjs(iD, oS, callback) {
            if (!iD.length && !oS.length) {
                callback();
                return;
            }
            if (!iD.length || !oS.length || iD.length != oS.length) {
                if (console)
                    console.error('Invalid data');
                callback(-1);
                return;
            }
            _dbOpObjsTemp = _dbOpObjsTemp.concat(iD);
            _dbOpObjsTemp2 = _dbOpObjsTemp2.concat(oS);
            setTimeout(function () {
                if (!_dbOpObjsTemp.length) {
                    if (callback)
                        callback();
                    return;
                }
                dbOpObjs0(_dbOpObjsTemp, _dbOpObjsTemp2, callback);
                _dbOpObjsTemp = [];
                _dbOpObjsTemp2 = [];
            }, 0);
        }
        function dbOpObjs0(iD, oS, callback) {
            if (!callback)
                callback = function () { }
            if (!iD.length && !oS.length) {
                callback();
                return;
            }
            if (!iD.length || !oS.length || iD.length != oS.length) {
                if (console)
                    console.error('Invalid data');
                callback(-1);
                return;
            }
            for (var i = 0; i < oS.length; i++) {
                if (!checkFormat(oS[i])) {
                    if (console)
                        console.error('Invalid data');
                    console.error(oS[i]);
                    callback(-1);
                    return;
                }
            }
            var isDel = clone(iD);
            var objs = clone(oS);
            for (var i = 0; i < objs.length - 1; i++) {
                var repeat = false;
                for (var j = i + 1; j < objs.length; j++) {
                    if (objs[i].uuid == objs[j].uuid) {
                        repeat = true;
                        break;
                    }
                }
                if (repeat) {
                    objs.splice(i, 1);
                    isDel.splice(i, 1);
                    i--;
                }
            }
            if (isDel && isDel.length) {
                if (queue.locked) {
                    queue.push(dbOpObjs, [isDel, objs, callback]);
                } else {
                    queue.lock();
                    callback = queue.fixCallBack(callback);
                    opIndexs(isDel, objs, function (sqlCMD) {
                        var eventobj = [];
                        var eventUuids = [];
                        var eventtype = [];
                        for (var i = 0; i < objs.length; i++) {
                            var isDelete = isDel[i];
                            var obj = objs[i];
                            if (isDelete) {
                                db.setDBcmd(obj.uuid, sqlCMD);
                            } else {
                                var obj2 = viewModelToEntity(obj);
                                db.setDBcmd(obj.uuid, obj2, sqlCMD);
                            }

                            if (dbModelEvent[obj.table] && ((dbModelEvent[obj.table].onDelete && isDelete == 1)
                                || (dbModelEvent[obj.table].onSave && isDelete != 1))
                            ) {
                                eventobj.push(obj);
                                eventUuids.push(obj.uuid);
                                eventtype.push(isDelete);
                            }
                        }
                        if (eventobj.length > 0) {
                            dbReadObjs(eventUuids, function (oldobjs) {
                                for (var i = 0; i < eventobj.length; i++) {
                                    var theOld = oldobjs[i];
                                    var thenew = eventobj[i];
                                    var table = thenew.table;
                                    if (eventtype[i] == 1 && theOld) {
                                        if (dbModelEvent[table].onDelete) {
                                            dbModelEvent[table].onDelete(theOld);
                                        }
                                    } else if (eventtype[i] != 1) {
                                        if (dbModelEvent[table].onSave) {
                                            dbModelEvent[table].onSave(theOld, thenew);
                                        }
                                    }
                                }
                                db.setDB(sqlCMD, callback);
                            });
                        } else {
                            db.setDB(sqlCMD, callback);
                        }

                    });
                }
            } else {
                callback();
            }
        }
        function dbWriteObj(obj, callback) {
            if (!isArray(obj)) {
                obj = [obj];
            }
            var isDel = [];
            for (var i = 0; i < obj.length; i++) {
                isDel.push(0);
            }
            dbOpObjs(isDel, obj, callback);
        }
        function dbDeleteObj(obj, callback) {
            if (!isArray(obj)) {
                obj = [obj];
            }
            var isDel = [];
            for (var i = 0; i < obj.length; i++) {
                isDel.push(1);
            }
            dbOpObjs(isDel, obj, callback);
        }
        function dbReadObj(uuid, callback) {
            db.getDB(uuid, 0, function (res) {
                if (res) {
                    var res2 = entityToViewModel(res, uuid);
                } else {
                    var res2 = {};
                }
                callback(res2);
            });
        }
        function dbReadObjs(uuids, callback) {
            db.getDB(uuids, 0, function (rows) {
                var res0 = [];
                for (var j = 0; j < rows.length; j++) {
                    var res = rows[j];
                    var res2 = entityToViewModel(res, uuids[j]);
                    res0.push(res2);
                }
                callback(res0);
            });
        }

        function dbWriteIndexToSqliteCMD(index, table, sqlcmd) {
            if (!sqlcmd)
                sqlcmd = [];
            for (var i = 0; i < index.length; i++) {
                var ref = index[i].r;
                if (!ref) {
                    index[i].r = 'r' + indexIdentity();
                    ref = index[i].r;
                }
                if (index[i].l) {
                    if (index[i].d) {
                        if (dbModelIndex[table] && dbModelIndex[table] != 'uuid') {
                            var str = '';
                            for (var j = 0; j < index[i].d.length; j++) {
                                if (j != 0)
                                    str += ',';
                                str += index[i].d[j].u + ',' + index[i].d[j].i;
                            }
                            db.setDBcmd(ref, str, sqlcmd);
                        } else {
                            var str = '';
                            for (var j = 0; j < index[i].d.length; j++) {
                                if (j != 0)
                                    str += ',';
                                str += index[i].d[j].u;
                            }
                            db.setDBcmd(ref, str, sqlcmd);
                        }
                        index[i].d = null;
                        delete index[i].d;
                    }
                } else {
                    indexIdentity(parseInt(ref.substr(1)));
                    db.setDBcmd(ref, sqlcmd);
                    index.splice(i, 1);
                    i--;
                }
            }
            db.setDBcmd("table." + table, index, sqlcmd);
            return sqlcmd;
        }

        function isIn(lst, min, max) {
            var res = false;
            for (var i = 0; i < lst.length; i++) {
                if (typeof (max) != 'undefined') {
                    if (max >= lst[i] && min <= lst[i]) {
                        res = true;
                        break;
                    }
                } else {
                    if (min == lst[i]) {
                        res = true;
                        break;
                    }
                }
            }
            return res;
        }
        function isInForEdit(lst, min, max, nextmin, premax, isfirst, islast) {
            if (isIn(lst, min, max)) {
                return true;
            }
            if (isfirst) {
                if (typeof (min) != 'undefined')
                    for (var i = 0; i < lst.length; i++) {
                        if (min > lst[i]) {
                            return true;
                        }
                    }
            } else {
                if (typeof (max) != 'undefined' && typeof (nextmin) != 'undefined')
                    for (var i = 0; i < lst.length; i++) {
                        if (max < lst[i] && lst[i] < nextmin) {
                            return true;
                        }
                    }
            }
            if (islast) {
                if (typeof (max) != 'undefined')
                    for (var i = 0; i < lst.length; i++) {
                        if (max < lst[i]) {
                            return true;
                        }
                    }
            } else {
                if (typeof (min) != 'undefined' && typeof (premax) != 'undefined')
                    for (var i = 0; i < lst.length; i++) {
                        if (min > lst[i] && lst[i] > premax) {
                            return true;
                        }
                    }
            }

            return false;
        }
        /*
        indexOperator: >,>=,<,<=,=,bt(between),in,sw(start with)
        if indexOperator='bt', value should be [minValue,maxValue]. the result will be >= minValue and <maxValue
        if indexOperator='in', value should be [val1,val2,val3...]
        */
        function dbReadIndex(table, indexOperator, indexValue, callback, forEdit) {
            if (typeof (indexOperator) == 'function') {
                callback = indexOperator;
                indexOperator = null;
                indexValue = null;
            }
            db.getDB("table." + table, 1, function (index) {
                index = index || [];
                var datareflst = [];
                var IndexObjs = [];
                for (var i = 0; i < index.length; i++) {
                    var min = index[i].s;
                    var max = index[i].e;

                    if (!forEdit) {
                        if (indexOperator == 'sw') {
                            if (typeof (min) == 'string' && typeof (max) == 'string') {
                                min = min.substr(0, indexValue.length);
                                max = max.substr(0, indexValue.length);
                            }
                        }
                        if ((!indexValue) ||
                            (indexOperator == '<' && min < indexValue) ||
                            (indexOperator == '<=' && min <= indexValue) ||
                            (indexOperator == '>' && max > indexValue) ||
                            (indexOperator == '>=' && max >= indexValue) ||
                            (indexOperator == '=' && max >= indexValue && min <= indexValue) ||
                            (indexOperator == 'bt' && max >= indexValue[0] && min <= indexValue[1]) ||
                            (indexOperator == 'in' && isIn(indexValue, min, max)) ||
                            (indexOperator == 'sw' && max >= indexValue && min <= indexValue)
                        ) {
                            IndexObjs.push(index[i]);
                            datareflst.push(index[i].r);
                        }
                    } else {
                        var nextmin = i < index.length - 1 ? index[i + 1].s : index.undefined;
                        var premax = i > 0 ? index[i - 1].e : index.undefined;
                        if ((!indexValue) ||
                            isInForEdit(indexValue, min, max, nextmin, premax, i == 0, i == index.length - 1)
                        ) {
                            IndexObjs.push(index[i]);
                            datareflst.push(index[i].r);
                        }
                    }
                }

                db.getDB(datareflst, 0, function (refdata) {
                    for (var i = 0; i < IndexObjs.length; i++) {
                        var indstr = refdata[i];
                        if (dbModelIndex[table] && dbModelIndex[table] != 'uuid') {
                            var inddata = indstr.split(',');
                            var newindedata = [];
                            for (var x = 0; x < inddata.length; x += 2) {
                                if (dbModelIndexType[table] == 'int') {
                                    newindedata.push({ u: inddata[x], i: parseInt(inddata[x + 1]) });
                                } else {
                                    newindedata.push({ u: inddata[x], i: inddata[x + 1] });
                                }
                            }
                            IndexObjs[i].d = newindedata;
                        } else {
                            var inddata = indstr.split(',');
                            var newindedata = [];
                            for (var x = 0; x < inddata.length; x++) {
                                if (dbModelIndexType[table] == 'int') {
                                    newindedata.push({ u: parseInt(inddata[x]) });
                                } else {
                                    newindedata.push({ u: inddata[x] });
                                }
                            }
                            IndexObjs[i].d = newindedata;
                        }
                    }
                    callback(index);
                });
            });
        }
        function compareIndex(obj, val) {
            var oval = getIndexVal(obj);
            if (oval == val)
                return 0;
            else if (oval < val)
                return -1;
            return 1;
        }
        function getIndexVal(obj) {
            var index = dbModelIndex[obj.table];
            if (!index)
                index = 'uuid';
            return obj[index];
        }
        function getIndexObj(obj) {
            var res = {
                u: obj.uuid
            };
            setIndexObj(obj, res);
            return res;
        }
        function setIndexObj(obj, i) {
            var index = dbModelIndex[obj.table];
            if (index && index != 'uuid')
                i.i = obj[index];
        }
        function setIndexLSE(indexObj) {
            var lst = indexObj.d;
            indexObj.l = lst.length;
            indexObj.s = typeof (lst[0].i) != 'undefined' ? lst[0].i : lst[0].u;
            indexObj.e = typeof (lst[lst.length - 1].i) != 'undefined' ? lst[lst.length - 1].i : lst[lst.length - 1].u;
        }
        function addObjToIndex(index, obj) {
            var ioi = 0;
            var theIndexObj = null;
            var setioi = 0;
            var thelst = index._d().filter(function () {
                this.ioi = setioi++;
                return !!this.d;
            });
            for (var i = 0; i < thelst.length; i++) {
                var iscatch = false;
                if (i == 0 && compareIndex(obj, thelst[i].s) < 0) {
                    iscatch = true;
                } else if (i == thelst.length - 1) {
                    iscatch = true;
                } else if (compareIndex(obj, thelst[i].s) >= 0 && compareIndex(obj, thelst[i + 1].s) < 0) {
                    iscatch = true;
                }
                if (iscatch) {
                    theIndexObj = thelst[i];
                    ioi = theIndexObj.ioi;
                    break;
                }
            }
            if (!theIndexObj) {
                theIndexObj = {
                    d: [getIndexObj(obj)]
                }
                setIndexLSE(theIndexObj);
                index.push(theIndexObj);
            } else {
                var indexLst = theIndexObj.d;
                if (indexLst.length) {
                    for (var i = 0; i < indexLst.length; i++) {
                        var te, ts;
                        if (i != 0) {
                            te = typeof (indexLst[i - 1].i) != 'undefined' ? indexLst[i - 1].i : indexLst[i - 1].u;
                        }
                        ts = typeof (indexLst[i].i) != 'undefined' ? indexLst[i].i : indexLst[i].u;
                        if ((i == 0 || compareIndex(obj, te) >= 0)
                            && compareIndex(obj, ts) < 0) {
                            indexLst.splice(i, 0, getIndexObj(obj));
                            break;
                        }
                        if (i == indexLst.length - 1) {
                            indexLst.push(getIndexObj(obj));
                            break;
                        }
                    }
                } else {
                    indexLst.push(getIndexObj(obj));
                }
                if (theIndexObj.l > indexLimit) {
                    var newLength = parseInt(indexLimit / 2);
                    theIndexObj.d = indexLst.slice(newLength);
                    setIndexLSE(theIndexObj);
                    var newIndexObj = {
                        d: indexLst.slice(0, newLength)
                    }
                    setIndexLSE(newIndexObj);
                    index.splice(ioi, 0, newIndexObj);
                } else {
                    setIndexLSE(theIndexObj);
                }
            }

            for (var i = 0; i < index.length; i++) {
                delete index[i].ioi;
            }
            return index;
        }
        function deleteObjFromIndex(index, obj) {
            var theIndexObjs = index._d().filter(function (item) {
                return compareIndex(obj, item.e) <= 0 && compareIndex(obj, item.s) >= 0;
            });
            theIndexObjs = theIndexObjs._d().filter(function (item) {
                return item.d._d().remove(obj.uuid, function (indexObj, uuid) {
                    return indexObj.u == uuid;
                });
            });
            if (theIndexObjs.length) {
                var theIndexObj = theIndexObjs[0];
                theIndexObj.l--;
                var indexLst = theIndexObj.d;
                if (indexLst.length) {
                    theIndexObj.s = typeof (indexLst[0].i) != 'undefined' ? indexLst[0].i : indexLst[0].u;
                    theIndexObj.e = typeof (indexLst[indexLst.length - 1].i) != 'undefined' ? indexLst[indexLst.length - 1].i : indexLst[indexLst.length - 1].u;
                }
            }
            return index;
        }
        function opIndexs(isDel, objs, callback) {
            var tabs = [];
            var uuids = [];
            for (var i = 0; i < objs.length; i++) {
                uuids.push(objs[i].uuid);
                var thetable = tabs._d().filter(function (item) {
                    return item.table == objs[i].table;
                });
                if (!thetable.length) {
                    thetable = { table: objs[i].table, indexs: [] }
                    tabs.push(thetable);
                } else
                    thetable = thetable[0];

                var indexVal = getIndexVal(objs[i]);
                if (!thetable.indexs._d().isContain(indexVal)) {
                    thetable.indexs.push(indexVal);
                }
            }
            dbReadObjs(uuids, function (oldObjs) {
                var temps = {};
                for (var i = 0; i < oldObjs.length; i++) {
                    if (oldObjs[i]) {
                        var thetable = tabs._d().filter(function (item) {
                            return item.table == oldObjs[i].table;
                        })[0];
                        var indexVal = getIndexVal(oldObjs[i]);
                        if (!thetable.indexs._d().isContain(indexVal)) {
                            thetable.indexs.push(indexVal);
                        }

                        temps[oldObjs[i].uuid] = oldObjs[i];
                    }
                }
                var tabsIndex = {};
                function _d(index) {
                    var nexts = tabs._d().filter(function (val) {
                        return !tabsIndex[val.table];
                    });
                    tabsIndex[nexts[0].table] = index;
                    if (nexts.length > 1) {
                        setTimeout(function () {
                            dbReadIndex(nexts[1].table, 'in', nexts[1].indexs, _d, 1);
                        }, 0);
                    } else {
                        for (var i = 0; i < objs.length; i++) {
                            var isdelete = isDel[i];
                            var index = tabsIndex[objs[i].table];

                            if (temps[objs[i].uuid])
                                index = deleteObjFromIndex(index, temps[objs[i].uuid]);
                            if (!isdelete)
                                index = addObjToIndex(index, objs[i]);
                            tabsIndex[objs[i].table] = index;
                        }
                        var sqlcmds = [];
                        for (var i = 0; i < tabs.length; i++) {
                            dbWriteIndexToSqliteCMD(tabsIndex[tabs[i].table], tabs[i].table, sqlcmds);
                        }
                        callback(sqlcmds);
                    }
                }
                dbReadIndex(tabs[0].table, 'in', tabs[0].indexs, _d, 1);
            });

        }
        /*
        filters: array Obj
         filter:[column,operator,value]
         operator:>,>=,<,<=,=,bt(between),in,con(contain),sw(start with),em(empty:null,''),ne(no empty)
        if operator='bt', value should be [minValue,maxValue]. the result will be >= minValue and <maxValue
        if operator='in', value should be [val1,val2,val3...]
        */
        function dbRead(table, filters, skip, take, callback) {
            if (typeof (filters) == 'function') {
                callback = filters;
                filters = [];
                skip = 0;
                take = 0;
            } else if (typeof (skip) == 'function') {
                callback = skip;
                skip = 0;
                take = 0;
            }
            if (queue.locked) {
                queue.push(dbRead, [table, filters, skip, take, callback]);
                return;
            }
            queue.lock();
            callback = queue.fixCallBack(callback);
            if (!filters)
                filters = [];
            if (filters.length > 0 && !isArray(filters[0])) {
                filters = [filters];
            }

            var indexOperator = null, indexValue = null;
            for (var i = 0; i < filters.length; i++) {
                if (filters[i][0] == dbModelIndex[table] && filters[i][1] != 'con' && filters[i][1] != 'em' && filters[i][1] != 'ne') {
                    indexOperator = filters[i][1];
                    indexValue = filters[i][2];
                    break;
                }
            }
            dbReadIndex(table, indexOperator, indexValue, function (index) {
                index = index._d().filter(function (item) {
                    return !!item.d;
                });
                if ((indexValue && filters.length == 1) || filters.length == 0) {
                    var keys = [];
                    var k = 0;
                    for (var i = 0; i < index.length; i++) {
                        for (var j = 0; j < index[i].d.length; j++) {
                            var val = typeof (index[i].d[j].i) != 'undefined' ? index[i].d[j].i : index[i].d[j].u;
                            if ((!indexValue) ||
                                (indexOperator == '<' && val < indexValue) ||
                                (indexOperator == '<=' && val <= indexValue) ||
                                (indexOperator == '>' && val > indexValue) ||
                                (indexOperator == '>=' && val >= indexValue) ||
                                (indexOperator == '=' && val == indexValue) ||
                                (indexOperator == 'bt' && val >= indexValue[0] && val < indexValue[1]) ||
                                (indexOperator == 'in' && isIn(indexValue, val)) ||
                                (indexOperator == 'sw' && val.indexOf(indexValue) == 0)
                            ) {
                                k++;
                                if (k > skip) {
                                    keys.push(index[i].d[j].u);
                                }
                                if (take && keys.length >= take) {
                                    break;
                                }
                            }
                        }
                        if (take && keys.length >= take) {
                            break;
                        }
                    }
                    db.getDB(keys, 0, function (rows) {
                        var res0 = [];
                        for (var j = 0; j < rows.length; j++) {
                            res0.push(entityToViewModel(rows[j], keys[j]));
                        }
                        callback(res0);
                    });
                } else {
                    var res0 = [];
                    var k = 0;
                    function _d() {
                        if (!index.length) {
                            callback(res0);
                        } else {
                            var theIndex = index.shift();
                            var keys = [];
                            for (var j = 0; j < theIndex.d.length; j++) {
                                keys.push(theIndex.d[j].u);
                            }
                            db.getDB(keys, 0, function (rows) {
                                for (var j = 0; j < rows.length; j++) {
                                    var resObj = entityToViewModel(rows[j], keys[j]);
                                    var ismatch = true;
                                    for (var i = 0; i < filters.length; i++) {
                                        var column = filters[i][0];
                                        var Operator = filters[i][1];
                                        var Value = filters[i][2];
                                        var val = resObj[column];
                                        if ((Operator == '<' && val < Value) ||
                                            (Operator == '<=' && val <= Value) ||
                                            (Operator == '>' && val > Value) ||
                                            (Operator == '>=' && val >= Value) ||
                                            (Operator == '=' && val == Value) ||
                                            (Operator == 'bt' && val >= Value[0] && val < Value[1]) ||
                                            (Operator == 'in' && isIn(Value, val)) ||
                                            (Operator == 'con' && typeof (val) == 'string' && val.indexOf(Value) != -1) ||
                                            (Operator == 'sw' && val.indexOf(Value) == 0) ||
                                            (Operator == 'em' && (val === null || val === '')) ||
                                            (Operator == 'ne' && (val !== null && val !== ''))
                                        ) {
                                        } else {
                                            ismatch = false;
                                            break;
                                        }
                                    }
                                    if (ismatch) {
                                        k++;
                                        if (k > skip) {
                                            res0.push(resObj);
                                        }
                                        if (take && res0.length >= take) {
                                            break;
                                        }
                                    }
                                }
                                if (take && res0.length >= take) {
                                    callback(res0);
                                } else {
                                    setTimeout(_d, 0);
                                }
                            });
                        }
                    }
                    _d();
                }
            });
        }
        this.dbOpObjs = dbOpObjs;
        this.dbWriteObj = dbWriteObj;
        this.dbDeleteObj = dbDeleteObj;
        this.dbRead = dbRead;
        this.dbReadObj = dbReadObj;
        this.dbReadObjs = dbReadObjs;
        this.clearDB = clearDB;
        this.checkFormat = checkFormat;
        this.get = function (key, isJSON) {
            return db.get(key, isJSON);
        }
        this.set = function (key, val) {
            return db.set(key, val);
        }
        this.getTable = function (table) {
            return new MyTable(this, table);
        }
        return this;
    }
    var _MyDBs = {}
    MyDB.get = function (dbName, dbType) {
        if (_MyDBs[dbName])
            return _MyDBs[dbName];
        _MyDBs[dbName] = new MyDB(dbName, dbType);
        return _MyDBs[dbName];
    }
    return MyDB;
})();