function initLogin(option) {
	thePatternLockObj = new PatternLock("#patternContainer", {
        'onDraw': function (res) {
            thePatternLockObj.reset();
            var pwd2 = $('#pwd2').val() || SysState.pwd2;
            var hasPwd2 = localStorage.getItem("hasPwd2");
            if (!hasPwd2)
                pwd2 = "";
            if (pwd2 || !hasPwd2 ||option.isChangeLoginKey) {
                option.onDraw(res, pwd2);
            } else {
                var drawres = res;
                jQuery.ajax({
                    url: SUrl() + "/SaveCode/Get",
                    dataType: "json",
                    type: "POST",
                    data: {
                        code: SCode(),
                        pwd: res
                    },
                    success: function (res) {
                        if (res.result == 1) {
                            option.onDraw(drawres, res.data);
                        } else if (res.result == 0 || res.result == -3) {
                            mAlert('二次密码已被清除');
                            SysState.ljcw.check();
                        } else if (res.result == -1) {
                            mAlert('服务器故障');
                        } else {
                            mAlert('密码错误');
                            SysState.ljcw.check();
                        }
                    },
                    error: function () {
                        mAlert('访问服务器失败');
                    }
                });
            }
        }
    });
    
    if(SysState.loginKey){
        initTitle(option.title ? option.title : 'keepPwd', getVisSize() > 1 && !(option && option.nogb) ? function () {
            if (option.isChangeLoginKey !== true)
    		    androidCancelUnLock();
    		pageGoBack();
        } : null);
        if (option.isChangeLoginKey !== true)
            androidUnLock();
        $('#div_pwd2').hide();
    }else{
        initTitle(option.title ? option.title : 'keepPwd', getVisSize() > 1 && !(option && option.nogb) ? pageGoBack : null);
        if (localStorage.getItem("hasPwd2")) {
            $('#div_pwd2').show();
        } else {
            $('#div_pwd2').hide();
        }
    }
}
