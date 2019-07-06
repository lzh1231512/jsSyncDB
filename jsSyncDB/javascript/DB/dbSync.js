
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
        var isOpenWebSocket = false;
        var WebSocketObj = null;
        var WSOpenDT = null;
        function openWebSocket(callback, reconnectionInterval) {
            var dt = new Date();
            if (WSOpenDT &&
                (((dt.getTime() - WSOpenDT.getTime()) * 1.0) / 1000) < reconnectionInterval) {
                return;
            }
            WSOpenDT = dt;

            closeWebSocket();
            WebSocketObj = new WebSocket(WebSocketUrl);
            WebSocketObj.onopen = function (evt) {
                console.log("WebSocket Connection open ...");
                isOpenWebSocket = true;
                WebSocketObj.send(JSON.stringify({
                    DBName: DbName,
                    Code: Code
                }));
                download(callback);
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
                console.log("Connection Error: " + evt.data);
            };
            $(window).on('beforeunload', closeWebSocket);
        }
        var wsHBdt = new Date();
        function keepWebSocketAlive() {
            if (isOpenWebSocket) {
                var dt = new Date();
                if (((dt.getTime() - wsHBdt.getTime()) * 1.0) / 1000 >= 300) {
                    WebSocketObj.send('1');
                    wsHBdt = dt;
                }
            }
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
        this.autoSync = function (callback, reconnectionInterval) {
            if (!reconnectionInterval)
                reconnectionInterval = 30;
            if (timer != null) {
                return;
            }
            if (typeof WebSocket != 'undefined') {
                timer = window.setInterval(function () {
                    if (!isOpenWebSocket) {
                        openWebSocket(callback, reconnectionInterval);
                    } else {
                        keepWebSocketAlive();
                    }
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