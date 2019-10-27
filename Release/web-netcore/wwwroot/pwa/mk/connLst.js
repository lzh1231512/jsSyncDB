function initconnLst() {
    function refLst() {
        var acLst;
        $('#rq').empty();
        DbConn.select(function (a) {
            acLst = a;
            for (var i = 0; i < acLst.length; i++) {
                var imgurl = '../images/set.svg';
                if (!hasSVG()) {
                    imgurl = '../images/set.png';
                }
                var str = '<div class="item"><img style="width:25px;height:25px;" src="' + imgurl + '"/><span>' + acLst[i].title + '</span></div>';
                $('#rq').append(str);
            }
            setBtnClickBG('.item');
            $('.item').mClick(function () {
                var indx = $('.item').index(this);
                var theAc = acLst[indx];
                loadPage('connEdit', {
                    c: theAc
                });
                return false;
            });
            $('#rq img').mClick(function () {
                var indx = $('#rq img').index(this);
                var tmenu = [
                    '修改',
                    '删除'
                ];
                mSel(acLst[indx].title, tmenu, function (ind) {
                    var theAc = acLst[indx];
                    if (tmenu[ind] == '修改') {
                        loadPage('connEdit', {
                            c: theAc
                        });
                    } else if (tmenu[ind] == '删除') {
                        mConfirm('确定要删除吗？', function (c) {
                            if (c) {
                                DbConn.del(theAc.uuid, function () {
                                    mAlert('操作成功', function () {
                                        refLst();
                                    });
                                });
                            }
                        });
                    }
                });
                return false;
            });
        });
        
    }
    refLst();
    initTitle('PC传输设置', function () { pageGoBack(true); }, function () {
        loadPage('connEdit');
    });
}