var isloadmainpage = false;
function IFLock(IKey) {
    if (SysState.IKey != IKey) {
        return;
    }
    if (!SysState.mainKey.get()) {
        return;
    }
    if(SysState.showLock){
    	return;
    }
    var time = (new Date()).getTime() - mk_lastLoadTime.getTime();
    isloadmainpage = time > 300000;
    SysState.showLock = true;
    Unlock();
}
function Unlock() {
    loadPage('login', {
        'onDraw': function (key,pwd2) {
            var mk = SysState.mainKey.get(key + pwd2);
            if (!mk) {
                mAlert('解锁密码错误', function () {
                    thePatternLockObj.reset();
                });
                SysState.ljcw.check();
            } else {
                SysState.ljcw.reset();
                SysState.loginKey = key;
                SysState.showLock = false;
                androidCancelUnLock();
                
                if (isloadmainpage || !pageGoBack(false, true)) {
                    loadPage('main');
                }
            }
        },
        nogb: true
    });
}
function IFUnLock(IKey) {
    if (SysState.IKey != IKey) {
        return;
    }
    if (SysState.loginKey && getCurrentPage() == 'login') {
        SysState.ljcw.reset();
        SysState.showLock = false;
        
        if (isloadmainpage || !pageGoBack(false, true)) {
            loadPage('main');
        }
    }
}
function IFGoBack(IKey) {
    if (SysState.IKey != IKey) {
        return;
    }
    if (getCurrentPage() == 'main') {
        androidNoBackPage();
        return false;
    }
    var obj = $('#sstckzzc:visible');
    if (obj.length > 0) {
        obj.click();
        return true;
    }
    obj = $('#ttleft:visible');
    if (obj.length) {
        obj.click();
        return true;
    }
    androidNoBackPage();
    return false;
}

function IFGetConnLst(IKey) {
    if (SysState.IKey != IKey) {
        return;
    }
    DbConn.select(function (lst) {
        for (var i = 0; i < lst.length; i++) {
            var obj = {
                type: '4',
                v1: '',
                v2: ''
            };
            var str = AES.Encrypt(lst[i].txmy, JSON.stringify(obj));
            lst[i].checkConnStr = str;
        }
        androidReturnConn(JSON.stringify(lst));
    });
}

function IFSetConnState(res) {
    /*
    var lst = JSON.parse(res);
    for (var i = 0; i < lst.length; i++) {
        var info = lst[i];
        var obj = DbConn.get(info.uuid);
        obj.state = info.state;
        DbConn.update(obj);
    }*/
}
