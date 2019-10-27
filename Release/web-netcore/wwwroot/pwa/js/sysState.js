SysState = {
    mainKey: {
        _tmp:null,
        get: function (key) {
            if (key) {
                var res = null;
                try {
                    res = AES.Decrypt(key, localStorage.getItem('SysState.mainKey'));
                } catch (e) {
                    res = null;
                }
                SysState._tmp = res;
                return res;
            }
            if (SysState._tmp)
                return SysState._tmp;
            return localStorage.getItem('SysState.mainKey');
        },
        set: function (val, key) {
            SysState._tmp = val;
            localStorage.setItem('SysState.mainKey', AES.Encrypt(key, val));
        },
        clear: function () {
        	SysState._tmp = null;
            localStorage.setItem('SysState.mainKey', '');
        }
    },
    UI:{
    	width:0,
    	height:0
    },
    loginKey: null,
    showLock:false,
    ljcw: {
        get: function () {
            return localStorage.getItem('SysState.ljcw');
        },
        add: function () {
            var lxcw = localStorage.getItem('SysState.ljcw');
            if (!lxcw)
                lxcw = 0;
            lxcw++;
            localStorage.setItem('SysState.ljcw', lxcw);
        },
        reset: function () {
            localStorage.setItem('SysState.ljcw', '0');
        },
        check: function () {
            SysState.ljcw.add();
            if (SysState.ljcw.get() >= 5) {
                mAlert('连续5次错误，清除所有数据', function () {
                    mainInit();
                    cleanVisHis();
                });
                localStorage.clear();
                SysState.ljcw.reset();
                baseDb.cleanAllData();
                SysState.mainKey.clear();
                SysState.loginKey = null;
            }
        }
    }
}