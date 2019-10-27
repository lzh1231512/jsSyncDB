var mySyncDB = new JssDB('', 'keepPwdDB', 'url');
function baseDb(acInfo) {
    this.def = acInfo;
    for (var i = 0; i < acInfo.length; i++) {
        var obj = acInfo[i];
        if (typeof (obj[2]) == 'function') {
            this[obj[0]] = obj[2]();
        } else if (typeof (obj[2]) != 'undefined') {
            this[obj[0]] = obj[2];
        } else {
            this[obj[0]] = null;
        }
    }
    return this;
}
baseDb.DB = [];
baseDb.initDB = function (DbTable) {
    var zmb = 'abcdefghijklmnopqrstuvwxyz';
    
    DbTable.add = function (mo, key,callback) {
        if (!mo.uuid)
            mo.uuid = uuid();
        var acInfo = this.def;
        var res = {table:mo.table};
        for (var i = 0; i < acInfo.length; i++) {
            var obj = acInfo[i];
            if (obj[0] == 'createTime' && !mo[obj[0]]) {
                res[obj[0]] = (new Date()).getTime();
            } else if (obj[0] == 'updateTime' && !mo[obj[0]]) {
                obj['updateTime'] = (new Date()).getTime();
            } else if (obj[1] == 1 && mo[obj[0]]) {
                res[obj[0]] = AES.Encrypt(key, mo[obj[0]]);
            } else {
                res[obj[0]] = mo[obj[0]];
            }
        }
        if (this.syncflag) {
            localStorage.setItem('syncflag', '1');
            mySyncDB.writeObj(res, callback);
        } else {
            mySyncDB.writeObjWithoutSync(res, callback);
        }
    }
    DbTable.update = function (mo, key, callback) {
        var acInfo = this.def;
        var syncflag = this.syncflag;
        mySyncDB.dbReadObj(mo.uuid, function (obj) {
            for (var i = 0; i < acInfo.length; i++) {
                var zdxx = acInfo[i];
                if (zdxx[0] == 'jyUUID') {
                    obj['jyUUID'] = obj['jyUUID'] + '|' + random(0, 99999);
                } else if (zdxx[0] == 'updateTime') {
                    obj['updateTime'] = (new Date()).getTime();
                } else {
                    if (mo[zdxx[0]] !== null && mo[zdxx[0]] !== -99) {
                        if (zdxx[1] == 1 && mo[zdxx[0]]) {
                            obj[zdxx[0]] = AES.Encrypt(key, mo[zdxx[0]]);
                        } else {
                            obj[zdxx[0]] = mo[zdxx[0]];
                        }
                    }
                }
            }
            if (syncflag) {
                localStorage.setItem('syncflag', '1');
                mySyncDB.writeObj(obj, callback);
            } else {
                mySyncDB.writeObjWithoutSync(obj, callback);
            }
        });
    }
    DbTable.baseSelectWithDecrypt = function (glcs, orderby, key, DecryptLst, callback) {
        var acInfo = this.def;
        DbTable.baseSelect(glcs, orderby, function (res) {
            for (var i = 0; i < res.length; i++) {
                for (var j = 0; j < acInfo.length; j++) {
                    var obj = acInfo[j];
                    if (DecryptLst) {
                        if (obj[1] == 1 && res[i][obj[0]] && DecryptLst.contains(obj[0])) {
                            res[i][obj[0]] = AES.Decrypt(key, res[i][obj[0]]);
                        }
                    } else {
                        if (obj[1] == 1 && res[i][obj[0]]) {
                            res[i][obj[0]] = AES.Decrypt(key, res[i][obj[0]]);
                        }
                    }
                }
            }
            if (orderby) {
                res.sort(function (a, b) {
                    if (typeof (orderby) == 'string') {
                        orderby = [orderby];
                    }
                    for (var i = 0; i < orderby.length; i++) {
                        var orderinfo = orderby[i].split(' ');
                        if (typeof (a[orderinfo[0]]) == 'string') {
                            var res = a[orderinfo[0]].localeCompare(b[orderinfo[0]]);
                        } else {
                            var res = a[orderinfo[0]] - b[orderinfo[0]];
                        }
                        if (res != 0) {
                            if (orderinfo[1] == 'desc' || orderinfo[1] == 'DESC') {
                                return res * (-1);
                            } else {
                                return res;
                            }
                        }
                    }
                    return 0;
                });
            }
            callback(res);
        });
        
    }
    DbTable.baseSelect = function (glcs, orderby, callback) {
        var acInfo = this.def;
        var filters = [];
        for (var j = 0; j < acInfo.length; j++) {
            var obj = acInfo[j];
            if (glcs && typeof (glcs[obj[0]]) != 'undefined') {
                var glsz = glcs[obj[0]].split(',');
                filters.push([obj[0], 'in', glsz]);
            }
        }
        mySyncDB.dbRead(this.tableName, filters, function (res) {
            if (orderby) {
                res.sort(function (a, b) {
                    if (typeof (orderby) == 'string') {
                        orderby = [orderby];
                    }
                    for (var i = 0; i < orderby.length; i++) {
                        var orderinfo = orderby[i].split(' ');
                        if (typeof (a[orderinfo[0]]) == 'string') {
                            var res = a[orderinfo[0]].localeCompare(b[orderinfo[0]]);
                        } else {
                            var res = a[orderinfo[0]] - b[orderinfo[0]];
                        }
                        if (res != 0) {
                            if (orderinfo[1] == 'desc' || orderinfo[1] == 'DESC') {
                                return res * (-1);
                            } else {
                                return res;
                            }
                        }
                    }
                    return 0;
                });
            }
            callback(res);
        });
    }
    DbTable.del = function (uuid, callback) {
    	var syncflag=this.syncflag;
        mySyncDB.dbReadObj(uuid, function (obj) {
            if (syncflag) {
                localStorage.setItem('syncflag', '1');
                mySyncDB.deleteObj(obj, callback);
            } else {
            	mySyncDB.deleteObjWithoutSync(obj, callback);
            }
        });
    }
    DbTable.get = function (uuid, callback) {
        mySyncDB.dbReadObj(uuid, callback);
    }
    DbTable.getWithDecrypt = function (uuid, key,callback) {
        DbTable.baseSelectWithDecrypt({ 'uuid': uuid }, null, key, null, function (lst) {
            callback(lst.length > 0?lst[0]:null);
        });
    }
    baseDb.DB.push(DbTable);
}
baseDb.cleanAllData = function (callback) {
    localStorage.setItem('lastMd5', '');
    mySyncDB.clear(callback);
}