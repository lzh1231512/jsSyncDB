var JssDB = function (code, dbName, serviceUrl, dbType) {
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

    var dbModelDisableSync = [];
    function SyncObj(id, objuuid, isDelete) {
        this._temp = JssDB._dbObj;
        this._temp(id, "mainSync");
        this.isDelete = isDelete;
        this.objuuid = objuuid;
        return this;
    }
    dbModelColumn['mainSync'] = ['isDelete', 'objuuid'];
    dbModelIndex['mainSync'] = "uuid";
    dbModelIndexType['mainSync'] = "int";
    dbModelTransformation['mainSync'] = {
        viewModelToEntity: function (obj) {
            return obj.isDelete + ',' + obj.objuuid;
        },
        entityToViewModel: function (res) {
            var info = res.split(',');
            return {
                isDelete: parseInt(info[0]),
                objuuid: info[1]
            };
        }
    }
    function newTempSyncObjUUID(db) {
        var res = db.get('newTempSyncObjUUID');
        if (!res)
            res = 0;
        res = parseInt(res) + 1;
        db.set('newTempSyncObjUUID', res);

        res = res + '';
        for (var i = 0, len = res.length; i < 8 - len; i++) {
            res = '0' + res;
        }
        return 't' + res;
    }
    function TempSyncObj(db, objuuid, isDelete) {
        this._temp = JssDB._dbObj;
        this._temp(newTempSyncObjUUID(db), "mainSync.Temp");
        this.isDelete = isDelete;
        this.objuuid = objuuid;
        return this;
    }
    dbModelColumn['mainSync.Temp'] = ['isDelete', 'objuuid'];
    dbModelTransformation['mainSync.Temp'] = dbModelTransformation['mainSync'];
    function MySyncDB(code, dbName, serviceUrl, dbType) {
        var DbName = dbName;
        var theDB = JssDB.dbCode.get(dbName + "_" + code, dbType);
        var Code = code;
        if (serviceUrl && serviceUrl.charAt(serviceUrl.length - 1) != '/')
            serviceUrl += '/';
        var UploadDBObj = serviceUrl + 'UploadDBObj';
        var DownloadDBObj = serviceUrl + 'DownloadDBObj';
        var WebSocketUrl = '';
        if (serviceUrl.indexOf('http://') == 0) {
            WebSocketUrl = "ws" + serviceUrl.substring(4) + 'ws';
        } else {
            WebSocketUrl = "wss" + serviceUrl.substring(5) + 'ws';
        }
        var hasNewData = false;
        var transferLimit = 100;
        var isWait = -1;

        function httpUpload(tempLst, isRestore, upUUID, localMaxId, callBack, errorCallBack) {
            if (tempLst.length) {
                var uploadobj = [];
                for (var i = 0; i < tempLst.length; i++) {
                    var obj = clone(tempLst[i]);
                    if (isRestore) {
                        obj.id = obj.uuid;
                    }
                    if (obj.data) {
                        delete obj.data.uuid;
                    }
                    obj.data = JSON.stringify(obj.data);
                    uploadobj.push(obj);
                }
                jQuery.ajax({
                    url: UploadDBObj,
                    dataType: "json",
                    type: "POST",
                    data: {
                        code: Code,
                        DBName: DbName,
                        Data: JSON.stringify(uploadobj),
                        uuid: databaseUUID(),
                        localUUID: localUUID(),
                        uploadUUID: upUUID,
                        restore: isRestore,
                        localMaxId: localMaxId
                    },
                    success: function (res) {
                        if (res.status == 1) {
                            if (!databaseUUID()) {
                                databaseUUID(res.uuid)
                            }
                            callBack(res.data);
                        } else {
                            errorCallBack(res.status, res.lastId);
                        }
                    },
                    error: function () {
                        errorCallBack(-9);
                    }
                });
            } else {
                callBack([]);
            }
        }
        function httpDownload(beginIndex, take, callBack, errorCallBack) {
            jQuery.ajax({
                url: DownloadDBObj,
                dataType: "json",
                type: "Get",
                data: {
                    code: Code,
                    DBName: DbName,
                    uuid: databaseUUID(),
                    beginId: beginIndex,
                    isWait: isWait,
                    take: take
                },
                success: function (result) {
                    if (result.status == 1) {
                        if (!databaseUUID()) {
                            databaseUUID(result.uuid)
                        }
                        var res = result.data;
                        for (var i = 0; i < res.length; i++) {
                            if (res[i] && JSON.parse(res[i].data)) {
                                res[i].data = JSON.parse(res[i].data);     
                                res[i].data.uuid = res[i].objuuid;
                            }
                        }
                    }
                    callBack(result);
                },
                error: function () {
                    errorCallBack(-9);
                }
            });
            if (isWait == 0)
                isWait = 1;
        }
        function opObj(isDelLst, objs, callback) {
            if (!objs._d().isContain(function () {
                return !dbModelDisableSync[this.table];
            })) {
                theDB.dbOpObjs(isDelLst, objs, callback);
                return;
            }
            var newisDel = []; var newobjs = [];
            for (var j = 0; j < objs.length; j++) {
                var obj = objs[j];
                if (!dbModelDisableSync[obj.table]) {
                    var tempdata = new TempSyncObj(theDB, obj.uuid, isDelLst[j]);
                    newisDel.push(0);
                    newobjs.push(tempdata);
                }
                newisDel.push(isDelLst[j]);
                newobjs.push(obj);
            }
            theDB.dbOpObjs(newisDel, newobjs, function () {
                hasNewData = true;
                if (callback)
                    callback();
            });
        }
        this.opObj = opObj;
        this.writeObj = function (obj, callback) {
            if (!isArray(obj)) {
                obj = [obj];
            }
            var isDel = [];
            for (var i = 0; i < obj.length; i++) {
                isDel.push(0);
            }
            opObj(isDel, obj, callback);
        }
        this.writeObjWithoutSync = function (obj, callback) {
            theDB.dbWriteObj(obj, callback);
        }
        this.deleteObjWithoutSync = function (obj, callback) {
            theDB.dbDeleteObj(obj, callback);
        }
        this.deleteObj = function (obj, callback) {
            if (!isArray(obj)) {
                obj = [obj];
            }
            var isDel = [];
            for (var i = 0; i < obj.length; i++) {
                isDel.push(1);
            }
            opObj(isDel, obj, callback);
        }
        this.readMainIndex = function (beginId, skip, take, callback) {
            if (typeof (skip) == 'function') {
                callback = skip;
                skip = 0;
                take = 0;
            }
            theDB.dbRead("mainSync", [['uuid', '>=', beginId]], skip, take, function (res) {
                var refs = [];
                for (var i = 0; i < res.length; i++) {
                    if (!res[i].isDelete) {
                        refs.push(res[i].objuuid);
                    }
                }
                theDB.dbReadObjs(refs, function (data) {
                    for (var i = 0; i < res.length; i++) {
                        if (!res[i].isDelete) {
                            for (var j = 0; j < data.length; j++) {
                                if (res[i].objuuid == data[j].uuid) {
                                    res[i].data = data[j];
                                    data.splice(j, 1);
                                    break;
                                }
                            }
                        }
                    }
                    callback(res);
                });
            });

        }
        function currentIndex(newindex) {
            if (typeof (newindex) != 'undefined') {
                theDB.set("index", newindex);
            } else {
                var currentIndex = parseInt(theDB.get("index") || 0);
                return currentIndex;
            }
        }
        function databaseUUID(newuuid) {
            if (typeof (newuuid) != 'undefined') {
                theDB.set("uuid", newuuid);
            } else {
                return theDB.get("uuid") || '';
            }
        }
        function localUUID() {
            var res = theDB.get("localUUID");
            if (!res) {
                res = uuid();
                theDB.set("localUUID", res);
            }
            return res;
        }
        function restoreSeek(restoreSeek) {
            if (typeof (restoreSeek) != 'undefined') {
                theDB.set("restoreSeek", restoreSeek);
            } else {
                var res = parseInt(theDB.get("restoreSeek")) || -1;
                return res;
            }
        }
        function uploadUUID(newuuid) {
            if (typeof (newuuid) != 'undefined') {
                theDB.set("uploadUUID", newuuid);
            } else {
                return theDB.get("uploadUUID") || '';
            }
        }
        function uploadUUIDForRestore(newuuid) {
            if (typeof (newuuid) != 'undefined') {
                theDB.set("uploadUUIDForRestore", newuuid);
            } else {
                return theDB.get("uploadUUIDForRestore") || '';
            }
        }
        this.dbReadObj = function (uuid, callback) {
            theDB.dbReadObj(uuid, callback);
        }
        /*
        filters: array Obj
         filter:[column,operator,value]
         operator:>,>=,<,<=,=,bt(between)
        if operator='bt', value should be [minValue,maxValue]. the result will be >= minValue and <maxValue
        */
        this.dbRead = function (table, filters, skip, take, callback) {
            theDB.dbRead(table, filters, skip, take, callback);
        };
        var isRestoreing = 0;
        //callback(status) 
        //status: array obj:new data
        //         1        :successfully
        //         -2       :in process
        //         -9       :other error
        function restore(callback) {
            if (!callback)
                callback = function () { }
            if (isRestoreing) {
                callback(-2);
                return;
            }
            isRestoreing = 1;
            console.log('begin to restore :' + restoreSeek());
            var finish = 0;
            function _uploadData(callback0) {
                var templst = null;
                if (!uploadUUIDForRestore()) {
                    uploadUUIDForRestore(uuid());
                    theDB.dbRead('mainSync', [['uuid', '>', restoreSeek()]], 0, transferLimit, function (templst) {
                        if (templst.length == 0) {
                            finish = 1;
                        }
                        theDB.set("tempUploadData", templst);
                        _d(templst);
                    });
                } else {
                    templst = theDB.get("tempUploadData", 1)
                    _d(templst);
                }
                function _d(templst) {
                    var uuids = [];
                    for (var i = 0; i < templst.length; i++) {
                        uuids.push(templst[i].objuuid);
                    }
                    theDB.dbReadObjs(uuids, function (reslst) {
                        for (var i = 0; i < templst.length; i++) {
                            templst[i].data = reslst[i];
                        }
                        callback0(templst);
                    });
                }
            }
            function _upload() {
                _uploadData(function (templst) {
                    httpUpload(templst, 1, uploadUUIDForRestore(), restoreSeek(), function (updata) {
                        uploadUUIDForRestore(null);
                        if (!finish) {
                            restoreSeek(updata[updata.length - 1].id);
                            _upload();
                        } else {
                            console.log('restore finish');
                            restoreSeek(-1);
                            isRestoreing = 0;
                            callback(1);
                        }
                    }, function (errorstatus) {
                        isRestoreing = 0;
                        callback(errorstatus);
                    });
                });
            }
            _upload();
        }

        var isUploading = 0;
        //callback(status) 
        //status: array obj:new data
        //         1        :successfully
        //         -3       :in process
        //         -9       :other error
        function upload(callback) {
            if (!callback)
                callback = function () { }
            if (isUploading || isRestoreing) {
                callback(-3);
                return;
            }
            isUploading = 1;
            function _uploadData(callback0) {
                var templst = null;
                if (!uploadUUID()) {
                    uploadUUID(uuid());
                    theDB.dbRead('mainSync.Temp', null, 0, transferLimit, function (templst) {
                        theDB.set("tempUploadData", templst);
                        _d(templst);
                    });
                } else {
                    templst = theDB.get("tempUploadData", 1);
                    _d(templst);
                }
                function _d(templst) {
                    var uuids = [];
                    for (var i = 0; i < templst.length; i++) {
                        uuids.push(templst[i].objuuid);
                    }
                    theDB.dbReadObjs(uuids, function (reslst) {
                        for (var i = 0; i < templst.length; i++) {
                            templst[i].data = reslst[i];
                        }
                        callback0(templst);
                    });
                }
            }
            function _upload() {
                _uploadData(function (templst) {
                    httpUpload(templst, 0, uploadUUID(), currentIndex(), function (updata) {
                        uploadUUID(null);
                        var localids = theDB.get("localids", 1) || {};
                        for (var i = 0; i < updata.length; i++) {
                            localids['s' + updata[i].id] = 1;
                        }
                        theDB.set("localids", localids);
                        var templst = theDB.get("tempUploadData", 1);
                        var dellst = [];
                        var delobjs = [];
                        for (var i = 0; i < updata.length; i++) {
                            for (var j = 0; j < templst.length; j++) {
                                if (templst[j].objuuid == updata[i].objuuid) {
                                    dellst.push(1);
                                    delobjs.push(templst[j]);
                                    break;
                                }
                            }
                        }
                        theDB.dbOpObjs(dellst, delobjs, function () {
                            theDB.dbRead('mainSync.Temp', function (tl) {
                                if (tl.length) {
                                    _upload();
                                } else {
                                    isUploading = 0;
                                    hasNewData = false;
                                    callback(1);
                                }
                            });
                        });
                    }, function (errorstatus, lastId) {
                        isUploading = 0
                        if (errorstatus == -2) {
                            restoreSeek(lastId);
                            restore(function (r) {
                                if (r == 1) {
                                    upload(callback)
                                } else {
                                    callback(r);
                                }
                            });
                        } else {
                            callback(errorstatus);
                        }
                    });
                });
            }
            _upload();
        }

        //callback(resdata) 
        //resdata: array obj:new data
        //         1        :sync successfully, but no new data
        //         -1       :uuid not match with service
        //         -2       :remote db lost data, will upload the missing data
        //         -9       :other error
        var isDownloading = 0;
        function download(callback) {
            if (isDownloading || isRestoreing) {
                //callback(-2);
                return;
            }
            isDownloading = 1;
            function _downloadWriteData(resData, callback0) {
                var isDelLst = [];
                var objs = [];
                for (var i = 0; i < resData.data.length; i++) {
                    var data = resData.data[i];
                    if (!data.fromLocal) {
                        if (data.isDelete) {
                            if (data.data && data.data.uuid && data.data.table) {
                                isDelLst.push(1);
                                objs.push(data.data);
                            }
                        } else {
                            isDelLst.push(0);
                            objs.push(data.data);
                        }
                    }

                    isDelLst.push(0);
                    objs.push(new SyncObj(parseInt(data.id), data.objuuid, data.isDelete));
                }

                for (var i = 0; resData.delIds && i < resData.delIds.length; i++) {
                    isDelLst.push(1);
                    objs.push({
                        uuid: resData.delIds[i],
                        table: 'mainSync'
                    });
                }

                theDB.dbOpObjs(isDelLst, objs, callback0);
            }
            function _download() {
                var take = transferLimit;
                httpDownload(currentIndex() + 1, take, function (resData) {
                    if (resData.status == 1) {
                        if (resData.data.length > 0) {
                            var localids = theDB.get("localids", 1) || {};
                            var tempNewData = theDB.get("tempNewData", 1) || [];
                            for (var i = 0; i < resData.data.length; i++) {
                                var data = resData.data[i];
                                if (localids['s' + data.id] == 1) {
                                    data.fromLocal = true;
                                    delete localids['s' + data.id];
                                } else {
                                    data.fromLocal = false;
                                }
                                tempNewData.push(data);
                            }
                            theDB.set("localids", localids);
                            theDB.set("tempNewData", tempNewData);
                            _downloadWriteData(resData, function () {
                                currentIndex(resData.data[resData.data.length - 1].id);
                                if (resData.data.length && parseInt(resData.data[resData.data.length - 1].id) < resData.maxId) {
                                    _download();
                                } else {
                                    isDownloading = 0
                                    var tempNewData = theDB.get("tempNewData", 1) || [];
                                    theDB.set("tempNewData");
                                    callback(tempNewData.length ? tempNewData : 1);
                                }
                            });
                        } else {
                            isDownloading = 0;
                            var tempNewData = theDB.get("tempNewData", 1) || [];
                            theDB.set("tempNewData");
                            callback(tempNewData.length ? tempNewData : 1);
                        }
                    } else {
                        if (resData.status == -2) {
                            isDownloading = 0;
                            restoreSeek(resData.maxId);
                            restore(function (r) {
                                callback(r);
                            });
                        } else {
                            isDownloading = 0;
                            callback(resData.status);
                        }
                    }
                }, function (errorstatus) {
                    isDownloading = 0
                    callback(errorstatus);
                });
            }
            _download();
        };

        //callback(resdata) 
        //resdata: array obj:new data
        //         0        :sync successfully, but no new data
        //         -1       :uuid not match with service
        //         -9       :other error
        this.sync = function (callback) {
            isWait = -1;
            function _d() {
                upload(function (status) {
                    if (status == 1) {
                        download(function (res) {
                            callback(res);
                        });
                    } else {
                        callback(-9);
                    }
                });
            }
            if (restoreSeek() >= 0) {
                restore(function (status) {
                    if (status == 1) {
                        _d();
                    } else {
                        callback(status);
                    }
                });
            } else {
                _d();
            }
        }

        var timer = null;
        var js = 0;
        var djs = 0;
        var isOpenWebSocket = false;
        var WebSocketObj = null;
        function openWebSocket(callback) {
            closeWebSocket();
            WebSocketObj = new WebSocket(WebSocketUrl);
            WebSocketObj.onopen = function (evt) {
                console.log("WebSocket Connection open ...");
                isOpenWebSocket = true;
                WebSocketObj.send(JSON.stringify({
                    DBName: DbName,
                    Code: Code
                }));
            };
            WebSocketObj.onmessage = function (evt) {
                isOpenWebSocket = true;
                console.log("Received Message: " + evt.data);
                if (evt.data == "1") {
                    download(callback);
                }
            };
            WebSocketObj.onclose = function (evt) {
                isOpenWebSocket = false;
                console.log("Connection closed.");
            };
            WebSocketObj.onerror = function (evt) {
                write("Error: " + evt.data);
            };
            $(window).on('beforeunload', closeWebSocket);
        }
        function closeWebSocket() {
            if (isOpenWebSocket) {
                WebSocketObj.close();
            }
            $(window).off('beforeunload', closeWebSocket);
        }
        //callback(resdata) 
        //resdata: array obj:new data
        //         0        :sync successfully, but no new data
        //         -1       :uuid not match with service
        //         -9       :other error
        this.autoSync = function (callback) {
            if (timer != null) {
                return;
            }
            if (typeof WebSocket != 'undefined') {
                timer = window.setInterval(function () {
                    if (!isOpenWebSocket) {
                        openWebSocket(callback);
                    }
                    if (djs <= 0) {
                        djs = 5 * 60;
                        download(callback);
                    }
                    djs--;
                    if (js > 0) {
                        js--;
                        return;
                    }
                    if (restoreSeek() >= 0) {
                        restore(function (status) {
                            if (status == -9) {
                                js += 30;
                            }
                        });
                    } else if (hasNewData){
                        upload(function (status) {
                            if (status == -9) {
                                js += 30;
                            }
                        });
                    }
                }, 1000);
            } else {
                isWait = 0;
                timer = window.setInterval(function () {
                    if (js > 0) {
                        js--;
                        return;
                    }
                    if (restoreSeek() >= 0) {
                        restore(function (status) {
                            if (status == -9) {
                                js += 30;
                            }
                        });
                    } else {
                        if (hasNewData)
                            upload(function (status) {
                                if (status == -9) {
                                    js += 30;
                                }
                            });
                        download(function (res) {
                            if (res == -9) {
                                js += 30;
                            }
                            callback(res);
                        });
                    }
                }, 1000);
            }
        }
        this.stopAutoSync = function () {
            if (timer) {
                window.clearInterval(timer);
            }
            timer = null;
            closeWebSocket();
        }
        this.clear = function (callback) {
            theDB.clearDB(callback);
        }
        this.getTable = function (table) {
            return theDB.getTable(table);
        }
        this.setService = function (code, url) {
            if (url && url.charAt(url.length - 1) != '/')
                url += '/';
            UploadDBObj = url + 'UploadDBObj';
            DownloadDBObj = url + 'DownloadDBObj';
            if (url.indexOf('http://') == 0) {
                WebSocketUrl = "ws" + url.substring(4) + 'ws';
            } else {
                WebSocketUrl = "wss" + url.substring(5) + 'ws';
            }
            Code = code;
        }
        return this;
    }
    _MySyncDBs = {};
    MySyncDB.get = function (dbName, code, serviceUrl, dbType) {
        if (_MySyncDBs[dbName])
            return _MySyncDBs[dbName];
        _MySyncDBs[dbName] = new MySyncDB(code, dbName, serviceUrl, dbType);
        return _MySyncDBs[dbName];
    }
    return MySyncDB(code, dbName, serviceUrl, dbType);
};
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
var JssDB = JssDB || {};
JssDB.tools = (function () {
    var BASE64_MAPPING = [
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
        'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
        'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
        'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
        'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
        'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
        'w', 'x', 'y', 'z', '0', '1', '2', '3',
        '4', '5', '6', '7', '8', '9', '+', '/'
    ];
    function uuid() {
        var s = [];
        var hexDigits = "0123456789abcdef";
        for (var i = 0; i < 36; i++) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
        s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
        s[8] = s[13] = s[18] = s[23] = "";//-

        var guid = s.join("");
        var binaryArray = [];
        for (var i = 0; i < 16; i++) {
            var j = i;
            if (i < 4) {
                j = 3 - i;
            } else if (i < 6) {
                j = 9 - i;
            } else if (i < 8) {
                j = 13 - i;
            }
            var d = parseInt(guid.substr(j * 2, 2), 16);
            binaryArray.push(d);
        }
        var base64 = '';
        for (var i = 0; i < binaryArray.length; i += 3) {
            var x = binaryArray[i] + 1;
            if (i + 1 < binaryArray.length) {
                x *= (binaryArray[i + 1] + 1);
            }
            if (i + 2 < binaryArray.length) {
                x *= (binaryArray[i + 2] + 1);
            }
            base64 += BASE64_MAPPING[(x % 64)];
            x = parseInt(x / 64);
            base64 += BASE64_MAPPING[(x % 64)];
            if (i < 15) {
                x = parseInt(x / 64);
                base64 += BASE64_MAPPING[(x % 64)];
                x = parseInt(x / 64);
                base64 += BASE64_MAPPING[(x)];
            }
        }

        return base64;
    }

    function clone(obj) {
        var val = JSON.stringify(obj);
        return JSON.parse(val);
    }

    function arrayExtend(lst) {
        this.lst = lst;
        return this;
    }
    if (!Array.prototype._d) {
        Array.prototype._d = function () {
            return new arrayExtend(this);
        };
    }
    if (!arrayExtend.prototype.isContain) {
        arrayExtend.prototype.isContain = function (val, compareFunc) {
            if (typeof (val) == 'function') {
                compareFunc = val;
                val = null;
            }
            var lst = this.lst;
            for (var i = 0; i < lst.length; i++) {
                if (compareFunc) {
                    if (compareFunc.apply(lst[i], [lst[i], val]))
                        return true;
                } else if (lst[i] == val) {
                    return true;
                }
            }
            return false;
        }
    }
    if (!arrayExtend.prototype.remove) {
        arrayExtend.prototype.remove = function (val, compareFunc) {
            var lst = this.lst;
            for (var i = 0; i < lst.length; i++) {
                if (compareFunc) {
                    if (compareFunc.apply(lst[i], [lst[i], val])) {
                        lst.splice(i, 1);
                        return true;
                    }
                } else {
                    if (lst[i] == val) {
                        lst.splice(i, 1);
                        return true;
                    }
                }
            }
            return false;
        }
    }
    if (!arrayExtend.prototype.filter) {
        arrayExtend.prototype.filter = function (filterFunc) {
            var res = [];
            var lst = this.lst;
            for (var i = 0; i < lst.length; i++) {
                if (filterFunc.apply(lst[i], [lst[i], i]))
                    res.push(lst[i]);
            }
            return res;
        }
    }

    function _check(check, func) {
        if (check)
            console.log(func + ' check:pass');
        else
            console.error(func + ' check:failed');
        return check;
    }
    function _log(log) {
        if (console)
            console.log(log);
    }
    function isArray(o) {
        return Object.prototype.toString.call(o) == '[object Array]';
    }

    function timepiece() {
        var dt = new Date();
        this.reset = function () {
            dt = new Date();
        }
        this.check = function () {
            var dt2 = new Date();
            return ((dt2.getTime() - dt.getTime()) * 1.0) / 1000;
        }
        this.show = function (msg) {
            var res = this.check();
            console.log('time spent: ' + res + 's ' + (msg || ''));
        }
        return this;
    }

    function ExecQueue() {
        this.locked = 0;
        var base = this;
        var queue = [];
        this.lock = function () {
            base.locked = 1;
        }
        this.push = function (fun, args) {
            queue.push([fun, args]);
        }
        this.release = function () {
            base.locked = 0;
            if (queue.length) {
                var info = queue.shift();
                info[0].apply(this, info[1]);
            }
        }
        this.fixCallBack = function (callback) {
            return function () {
                setTimeout(function () {
                    base.locked = 0;
                    if (queue.length) {
                        var info = queue.shift();
                        info[0].apply(this, info[1]);
                    }
                }, 0);
                if (callback)
                    callback.apply(this, arguments);
            };
        }
    }

    return {
        uuid: uuid,
        clone: clone,
        arrayExtend: arrayExtend,
        _check: _check,
        _log: _log,
        isArray: isArray,
        timepiece: timepiece,
        ExecQueue: ExecQueue,
        toGlobal: function (fun) {
            fun.uuid = uuid;
            fun.clone = clone;
            fun.arrayExtend = arrayExtend;
            fun._check = _check;
            fun._log = _log;
            fun.isArray = isArray;
            fun.timepiece = timepiece;
            fun.ExecQueue = ExecQueue;
        }
    };
})();
var JssDB = JssDB || {};
JssDB.dbCache = function dbCache(limit) {
    var uuid = JssDB.tools.uuid;
    var clone = JssDB.tools.clone;
    var arrayExtend = JssDB.tools.arrayExtend;
    var _check = JssDB.tools._check;
    var _log = JssDB.tools._log;
    var isArray = JssDB.tools.isArray;
    var timepiece = JssDB.tools.timepiece;
    var ExecQueue = JssDB.tools.ExecQueue;

    this.limit = limit;
    var theCache = {}
    var theCacheCheck = {}
    var keys = [];
    var keysIterator = keys._d();
    this.length = 0;
    this.exists = function (key) {
        key += '';
        return !!theCacheCheck[key];
    }
    this.clear = function () {
        keys = [];
        keysIterator = keys._d();
        theCache = {}
        theCacheCheck = {}
        this.length = 0;
    }
    this.get = function (key) {
        key = key + '';
        if (typeof (theCache[key]) == 'undefined') {
            return null;
        }
        return theCache[key];
    }
    this.set = function (key, val) {
        key = key + '';
        if (!keysIterator.isContain(key)) {
            keys.push(key);
        }
        if (typeof (val) == 'undefined') {
            val = null;
        }
        if (this.limit) {
            var old = theCache[key];
            var oldlength = old ? old.length : 0;
            var newlength = val ? val.length : 0;
            this.length += newlength - oldlength;
        }
        theCache[key] = val;
        theCacheCheck[key] = 1;
        if (this.limit && this.length > this.limit) {
            var newlimit = this.limit * 0.7;
            while (this.length > newlimit) {
                var delkey = keys.shift();
                delete theCacheCheck[delkey];
                var val = theCache[delkey];
                if (val) {
                    this.length -= val.length;
                }
                delete theCache[delkey];
            }
        }
    }
}

var JssDB = JssDB || {};
JssDB.dbBase = (function () {
    var uuid = JssDB.tools.uuid;
    var clone = JssDB.tools.clone;
    var arrayExtend = JssDB.tools.arrayExtend;
    var _check = JssDB.tools._check;
    var _log = JssDB.tools._log;
    var isArray = JssDB.tools.isArray;
    var timepiece = JssDB.tools.timepiece;
    var ExecQueue = JssDB.tools.ExecQueue;
    var dbCache = JssDB.dbCache;

    function MyBaseDB(dbName, dbType) {
        
        var DbName = dbName;
        var db;
        var theCache = new dbCache();
        var theCache2 = new dbCache(10 * 1024 * 1024);
        if (!dbType) {
            dbType = get('dbtype');
        }
        if (dbType) {
            if (JssDB.dbBase[dbType] && JssDB.dbBase[dbType].isSupport()) {
                db = new JssDB.dbBase[dbType](dbName);
                _log('using ' + JssDB.dbBase[dbType].dbname);
            }
        }

        if (!db) {
            var p = 0, d;
            for (var i in JssDB.dbBase) {
                if (typeof (JssDB.dbBase[i].isSupport) == "function" && JssDB.dbBase[i].isSupport() && JssDB.dbBase[i].priority > p) {
                    p = JssDB.dbBase[i].priority;
                    d = JssDB.dbBase[i];
                }
            }
            if (d) {
                db = new d(dbName);
                _log('using ' + d.dbname);
            } else {
                _log('No support any local database');
                return;
            }
        }



        function getkey(k) {
            return DbName + '.' + k;
        }
        function get(key, isJSON) {
            if (theCache.exists(key)) {
                var res = theCache.get(key);
            } else {
                var res = localStorage.getItem(getkey(key));
                theCache.set(key, res);
            }
            if (isJSON && res)
                res = JSON.parse(res);
            return res;
        }
        function set(key, val) {
            if (typeof (val) != 'undefined') {
                if (typeof (val) == 'object' && val !== null)
                    val = JSON.stringify(val);
                else if (val !== null)
                    val = val + '';
                theCache.set(key, val);
                if (val === null)
                    localStorage.removeItem(getkey(key));
                else
                    localStorage.setItem(getkey(key), val);
            } else {
                theCache.set(key);
                localStorage.removeItem(getkey(key));
            }
        }
        function clear(callback) {
            var removekeys = [];
            for (var i = 0, len = localStorage.length; i < len; i++) {
                var key = localStorage.key(i);
                if (key.indexOf(DbName + ".") == 0) {
                    removekeys.push(key);
                }
            }
            for (var i = 0; i < removekeys.length; i++) {
                localStorage.removeItem(removekeys[i]);
            }
            theCache.clear();
            theCache2.clear();
            db.clear(callback);
        }
        function getDB(key, isJSON, callback) {
            var isLst = isArray(key);
            if (!isLst)
                key = [key];
            var res = [];
            var dbkey = [];
            var dbkeyIndex = [];
            for (var i = 0; i < key.length; i++) {
                if (theCache2.exists(key[i])) {
                    var val = theCache2.get(key[i]);
                    if (val && isJSON)
                        val = JSON.parse(val);
                    res.push(val);
                } else {
                    dbkey.push(key[i]);
                    dbkeyIndex.push(i);
                    res.push(null);
                }
            }
            function _d(dbData) {
                for (var i = 0; i < dbData.length; i++) {
                    res[dbkeyIndex[i]] = dbData[i];
                }
                if (!isLst) {
                    return callback(res[0]);
                } else {
                    return callback(res);
                }
            }
            if (dbkey.length) {
                db.getVals(dbkey, isJSON, _d);
            } else {
                setTimeout(function () {
                    _d([]);
                }, 0);
            }
        }
        function setDB(key, val, callback) {
            if (!isArray(key)) {
                var sqlcmd = [];
                if (typeof (val) != 'function')
                    setDBcmd(key, val, sqlcmd);
                else
                    setDBcmd(key, sqlcmd);
            } else {
                var sqlcmd = key;
            }
            if (typeof (callback) == 'undefined') {
                callback = val;
            }
            if (!callback)
                callback = function () { }
            db.exec(sqlcmd, theCache2, callback);
        }
        function setDBcmd(key, val, sqlCMD) {
            var isdel = false;
            if (typeof (sqlCMD) == 'undefined') {
                sqlCMD = val;
                isdel = true;
            }
            db.delCmd(key, sqlCMD);
            if (!isdel) {
                if (typeof (val) == 'object')
                    val = JSON.stringify(val);
                else if (val)
                    val = val + '';
                db.addCmd(key, val, sqlCMD);
            }
        }

        this.get = get;
        this.set = set;
        this.setDB = setDB;
        this.setDBcmd = setDBcmd;
        this.getDB = getDB;
        this.clear = clear;
    }
    var _MyBaseDBs = [];
    MyBaseDB.get = function (dbName, dbType) {
        if (_MyBaseDBs[dbName])
            return _MyBaseDBs[dbName];
        _MyBaseDBs[dbName] = new MyBaseDB(dbName, dbType);
        return _MyBaseDBs[dbName];
    }

    return MyBaseDB;
})();
var JssDB = JssDB || {};
JssDB.dbBase = JssDB.dbBase || {};
JssDB.dbBase.Sqlite = (function () {
    var uuid = JssDB.tools.uuid;
    var clone = JssDB.tools.clone;
    var arrayExtend = JssDB.tools.arrayExtend;
    var _check = JssDB.tools._check;
    var _log = JssDB.tools._log;
    var isArray = JssDB.tools.isArray;
    var timepiece = JssDB.tools.timepiece;
    var ExecQueue = JssDB.tools.ExecQueue;
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
        function execSqliteCMD(sqlCMD, theCache2, callback) {
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
                for (var i = 0; i < 100 && ind < keys.length; i++ , ind++) {
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
        var result = typeof (openDatabase) != 'undefined';
        if (result) {
            try {
                var test = new MyDbSqlite('_isSupportSqlite');
            } catch (error) {
                result = false;
            }
        }
        return result;
    }
    MyDbSqlite.dbname = "Sqlite";
    MyDbSqlite.priority = 2;

    return MyDbSqlite;
})();
var JssDB = JssDB || {};
JssDB.dbBase = JssDB.dbBase || {};
JssDB.dbBase.LocalStorage = (function () {
    var uuid = JssDB.tools.uuid;
    var clone = JssDB.tools.clone;
    var arrayExtend = JssDB.tools.arrayExtend;
    var _check = JssDB.tools._check;
    var _log = JssDB.tools._log;
    var isArray = JssDB.tools.isArray;
    var timepiece = JssDB.tools.timepiece;
    var ExecQueue = JssDB.tools.ExecQueue;
    function MyDbLocalStorage(dbName) {
        var DbName = dbName;
        function getkey(k) {
            return DbName + '.' + k;
        }
        function get(key, isJSON) {
            var res = localStorage.getItem(getkey(key));
            if (isJSON && res)
                res = JSON.parse(res);
            return res;
        }
        function set(key, val) {
            if (typeof (val) != 'string')
                val = JSON.stringify(val);
            if (typeof (val) != 'undefined')
                localStorage.setItem(getkey(key), val);
            else
                localStorage.removeItem(getkey(key));
        }

        this.delCmd = function (key, sqlCMD) {
            sqlCMD.push({ ac: 'del', key: key });
        }
        this.addCmd = function (key, val, sqlCMD) {
            sqlCMD.push({ ac: 'set', key: key, val: val });
        }
        this.exec = function (sqlCMD, theCache2, callback) {
            for (var i = 0; i < sqlCMD.length; i++) {
                var cmd = sqlCMD[i];
                if (cmd.ac == 'del') {
                    set(cmd.key);
                } else {
                    set(cmd.key, cmd.val);
                }
                theCache2.set(cmd.key, cmd.val);
            }
            callback();
        }
        this.getVals = function (keys, isJSON, callback) {
            var res = [];
            for (var i = 0; i < keys.length; i++) {
                var val = get(keys[i], isJSON);
                res.push(val);
            }
            callback(res);
        }
        this.clear = function (callback) {
            if (callback)
                callback();
        };
    }
    MyDbLocalStorage.dbname = "LocalStorage";
    MyDbLocalStorage.priority = 1;
    MyDbLocalStorage.isSupport = function () {
        return typeof (localStorage) != 'undefined';
    }
    return MyDbLocalStorage;
})();

var JssDB = JssDB || {};
JssDB.dbBase = JssDB.dbBase || {};
JssDB.dbBase.IndexedDB = (function () {
    var uuid = JssDB.tools.uuid;
    var clone = JssDB.tools.clone;
    var arrayExtend = JssDB.tools.arrayExtend;
    var _check = JssDB.tools._check;
    var _log = JssDB.tools._log;
    var isArray = JssDB.tools.isArray;
    var timepiece = JssDB.tools.timepiece;
    var ExecQueue = JssDB.tools.ExecQueue;
    function MyDbIndexedDB(dbName) {
        var DbName = dbName;
        var storeName = "t_main";
        var db = null;

        function openDB(callback) {
            if (db) {
                callback(db);
                return;
            }
            var version = 1;
            var request = window.indexedDB.open(DbName, version);
            request.onerror = function (e) {
                console.log(e.currentTarget.error.message);
            };
            request.onsuccess = function (e) {
                db = e.target.result;
                callback(db);
            };
            request.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: "key" });
                }
            };
        }

        this.delCmd = function (key, sqlCMD) {
            sqlCMD.push({ ac: 'del', key: key });
        }
        this.addCmd = function (key, val, sqlCMD) {
            sqlCMD.push({ ac: 'set', key: key, val: val });
        }
        this.exec = function (sqlCMD, theCache2, callback) {
            openDB(function () {
                var transaction = db.transaction(storeName, 'readwrite');
                var store = transaction.objectStore(storeName);
                for (var i = 0; i < sqlCMD.length; i++) {
                    theCache2.set(sqlCMD[i].key, sqlCMD[i].val);
                    var request;
                    if (sqlCMD[i].ac == 'del') {
                        request = store.delete(sqlCMD[i].key);
                    } else {
                        delete sqlCMD[i].ac;
                        request = store.put(sqlCMD[i]);
                    }
                    request.onerror = function (event) {
                        console.log(event);
                    }
                    if (i == sqlCMD.length - 1) {
                        request.onsuccess = function () {
                            callback();
                        };
                    }
                }
            });
        }
        this.getVals = function (keys, isJSON, callback) {
            if (!keys.length) {
                callback([]);
                return;
            }
            var theKeys = clone(keys);
            openDB(function () {
                var res = [];
                var ind = 0;
                function _d() {
                    var tmpkeys = [];
                    for (var i = 0; i < 100 && ind < keys.length; i++ , ind++) {
                        tmpkeys.push(keys[ind]);
                    }
                    var transaction = db.transaction(storeName, 'readwrite');
                    var store = transaction.objectStore(storeName);
                    for (var i = 0; i < tmpkeys.length; i++) {
                        if (i < tmpkeys.length - 1) {
                            var request = store.get(tmpkeys[i]);
                            request.onsuccess = function (e) {
                                var re = e.target.result;
                                if (re)
                                    res.push(isJSON ? JSON.parse(re.val) : re.val);
                                else
                                    res.push(null);
                            };
                        } else {
                            var request = store.get(tmpkeys[i]);
                            request.onsuccess = function (e) {
                                var re = e.target.result;
                                if (re)
                                    res.push(isJSON ? JSON.parse(re.val) : re.val);
                                else
                                    res.push(null);
                                if (ind == keys.length) {
                                    callback(res);
                                } else {
                                    _d();
                                }
                            };
                        }
                    }

                }
                _d();
            });
        }
        this.clear = function (callback) {
            openDB(function () {
                var transaction = db.transaction(storeName, 'readwrite');
                var store = transaction.objectStore(storeName);
                var request = store.clear();
                request.onsuccess = function (e) {
                    if (callback)
                        callback();
                };
            });
        };
    }
    MyDbIndexedDB.dbname = "IndexedDB";
    MyDbIndexedDB.priority = 3;
    MyDbIndexedDB.isSupport = function () {
        var result = typeof (window.indexedDB) != 'undefined';
        if (result) {
            try {
                var test = new MyDbIndexedDB('_isSupportIndexedDB');
            } catch (error) {
                result = false;
            }
        }
        return result;
    }
    return MyDbIndexedDB;
})();


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