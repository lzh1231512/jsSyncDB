function initacAdd(option) {
    var theGroup = option.g;
    initTitle('添加账号', pageGoBack);
    var w = $('html').width();
    $('.item input').width(w - 80);
    $('textarea').width(w - 46);
    $('#sjmm').mClick(function () {
        loadPage('randomPwd', {
            cb: function (res) {
                $('#mm').val(res);
            }
        });
    });
    $('#wc').mClick(function () {
        var bt = $('#bt').val();
        var zh = $('#zh').val();
        var f2a = $('#f2a').val();
        var url = $('#url').val();
        var mm = $('#mm').val();
        var email = $('#email').val();
        var bz = $('#bz').val();
        if (!bt) {
            mAlert('标题不能为空');
            return;
        }
        if (!zh) {
            mAlert('账号不能为空');
            return;
        }
        if (!mm) {
            mAlert('密码不能为空');
            return;
        }
        var ac = new DbAc();
        ac.uuid = uuid();
        ac.groupId = theGroup.uuid;
        ac.title = bt;
        ac.uid = zh;
        ac.eMail = email;
        ac.summary = bz;
        ac.url = url;
        ac.F2A = f2a;
        ac.status = 1;
        DbAc.add(ac, SysState.mainKey.get(), function () {
            var pwd = new DbPwd();
            pwd.pUUID = ac.uuid;
            pwd.pwd = mm;
            pwd.xh = 0;
            DbPwd.add(pwd, SysState.mainKey.get(), function () {
                mAlert('操作成功', function () {
                    pageGoBack(true);
                });
            });
        });
    });
}