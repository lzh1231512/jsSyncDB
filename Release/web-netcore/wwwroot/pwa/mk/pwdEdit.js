function initpwdEdit(option) {
    var theAc = option.ac;
    initTitle('修改密码', pageGoBack);
    var w = $('html').width();
    $('.item input').width(w - 80);

    $('#wc').mClick(function () {
        var mm = $('#mm').val();
        if (!mm) {
            mAlert('新密码不能为空');
            return;
        }
        var pwd = new DbPwd();
        pwd.pUUID = theAc.uuid;
        pwd.pwd = mm;
        DbPwd.select(theAc.uuid,null, function (pwdlst) {
            pwd.xh = pwdlst.length;
            DbPwd.add(pwd, SysState.mainKey.get(), function () {
                mAlert('操作成功', function () {
                    pageGoBack(true);
                });
            });
        });
        
    });
    $('#sjmm').mClick(function () {
        loadPage('randomPwd', {
            cb: function (res) {
                $('#mm').val(res);
            }
        });
    });
}