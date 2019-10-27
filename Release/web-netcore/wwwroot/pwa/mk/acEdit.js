function initacEdit(option) {
    var theAc = option.ac;
    initTitle('修改账号', pageGoBack);
    var w = $('html').width();
    $('.item input').width(w - 80);
    $('textarea').width(w - 46);
    $('#bt').val(theAc.title);
    $('#zh').val(theAc.uid);
    $('#f2a').val(theAc.F2A);
    $('#url').val(theAc.url);
    $('#email').val(theAc.eMail);
    $('#bz').val(theAc.summary);

    $('#wc').mClick(function () {
        var bt = $('#bt').val();
        var zh = $('#zh').val();
        var f2a = $('#f2a').val();
        var url = $('#url').val();
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
        theAc.title = bt;
        theAc.uid = zh;
        theAc.eMail = email;
        theAc.summary = bz;
        theAc.F2A = f2a;
        theAc.url = url;
        DbAc.update(theAc, SysState.mainKey.get(), function () {
            mAlert('操作成功', function () {
                pageGoBack(true);
            });
        });
    });
}