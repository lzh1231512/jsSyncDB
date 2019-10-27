function initpwdHis(option) {
    var theAc = option.ac;
    function refLst() {
        $('#rq').empty();
        DbPwd.selectWithDecrypt(theAc.uuid, 'desc', SysState.mainKey.get(), function (pwdLst) {
            for (var i = 0; i < pwdLst.length; i++) {
                var dt = new Date(pwdLst[i].createTime);

                var str = '<div class="item"><span class="time">' + dt.pattern('yyyy-MM-dd<br/>HH:mm:ss') + '</span><span>' + pwdLst[i].pwd + '</span></div>';
                $('#rq').append(str);
            }
        });
    }
    refLst();
    initTitle(theAc.title + ' 历史密码', pageGoBack);
}