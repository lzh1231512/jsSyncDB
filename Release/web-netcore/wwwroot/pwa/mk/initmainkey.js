function initinitmainkey(option) {
    initTitle('请设置初始密码');
    $('#btnqd').mClick(function () {
        var mainkey = $('#inp').val();
        if (!mainkey) {
            mAlert('初始密码不能为空');
            return;
        }
        getloginkey(null, function (key) {
            SysState.mainKey.set(mainkey, key);
            SysState.loginKey = key;
            SysState.pwd2 = '';
            option.onSeted();
        });
    });

    function getloginkey(key1,callback) {
        loadPage('login', {
            title:key1?'请重复解锁图形':'请设置解锁图形',
            'onDraw': function (key2) {
                if (key1) {
                    if (key2 == key1) {
                        callback(key1);
                    } else {
                        mAlert('两次密码不一致', function () {
                            getloginkey(null, callback);
                        });
                    }
                } else {
                    getloginkey(key2, callback);
                }
            }
        });
    }
}