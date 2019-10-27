function initserverSet() {
    initTitle('同步服务器设置', pageGoBack);
    var w = $('html').width();
    $('.item input').width(w - 100);
    var dz = localStorage.getItem('serverUrl');
    var code = localStorage.getItem('serverCode');
    $('#dz').val(dz);
    if (!dz) {
        $('#dz').val('https://');
    }
    $('#code').val(code);
    if (dz && code && localStorage.getItem("hasPwd2")) {
        jQuery.ajax({
            url: dz + "/SaveCode/Get",
            dataType: "json",
            type: "POST",
            data: {
                code: code,
                pwd: SysState.loginKey
            },
            success: function (res) {
                if (res.result == 1) {
                    $('#pwd2').val(res.data);
                }
            },
            error: function () {
                mAlert('访问服务器失败');
            }
        });
    }
    $('#wc').mClick(function () {
        var dz = $('#dz').val();
        var code = $('#code').val();
        var pwd2 = $('#pwd2').val();
        if (!dz) {
            mAlert('服务地址不能为空');
            return;
        }
        if (!code) {
            mAlert('code不能为空');
            return;
        }
        if (dz.charAt(dz.length - 1) == '/')
            dz = dz.substr(0, dz.length - 1);
        localStorage.setItem('serverUrl',dz);
        localStorage.setItem('serverCode', code);
        jQuery.ajax({
            url: dz +"/SaveCode/Set",
            dataType: "json",
            type: "POST",
            data: {
                code: code,
                data: pwd2,
                pwd: SysState.loginKey
            },
            success: function (res) {
                if (res.result) {
                    localStorage.setItem('hasPwd2', pwd2 != "" ? "1" : "");
                    var mk = SysState.mainKey.get();
                    SysState.mainKey.set(mk, SysState.loginKey + pwd2);
                    SysState.pwd2 = pwd2;
                    mAlert('操作成功', function () {
                        pageGoBack();
                    });
                } else {
                    mAlert('设置服务器二次密码失败');
                }
            },
            error: function () {
                mAlert('访问服务器失败');
            }
        });
        
    });
}