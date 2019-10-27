function initac(option) {
    var theAcLst = option.theAcLst;
    var theGroup = option.g;
    var groupLst;
    var glst = [];
    DbGroup.selectWithDecrypt(1, SysState.mainKey.get(), function (g) {
        groupLst = g;
        for (var i = 0; i < groupLst.length; i++) {
            glst.push(groupLst[i].name);
        }
        refLst();
    });
    
    function refLst() {
        var acLst;

        function _getAcLst(callback) {
            if (theAcLst) {
                acLst = theAcLst;
                callback();
            } else {
                DbAc.selectWithDecrypt(theGroup.uuid, 1, SysState.mainKey.get(), ['title'], function (r) {
                    acLst = r;
                    callback();
                });
            }
        }
        $('#rq').empty();
        _getAcLst(function () {
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
                DbAc.getWithDecrypt(acLst[indx].uuid, SysState.mainKey.get(), function (theAc) {
                    loadPage('acShow', {
                        ac: theAc,
                        c: option.c
                    });
                });
                return false;
            });
            $('#rq img').mClick(function () {
                if (SysState.showLock) {
                    mAlert('请先解锁');
                    return false;
                }
                var indx = $('#rq img').index(this);
                var tmenu = [
                    '修改账号',
                    '删除账号',
                    '移动分组',
                    '修改密码',
                    '查看历史密码'
                ];
                mSel(acLst[indx].title, tmenu, function (ind) {
                    DbAc.getWithDecrypt(acLst[indx].uuid, SysState.mainKey.get(), function (theAc) {
                        if (tmenu[ind] == '修改账号') {
                            loadPage('acEdit', {
                                ac: theAc
                            });
                        } else if (tmenu[ind] == '删除账号') {
                            mConfirm('确定要删除吗？', function (c) {
                                if (c) {
                                    DbPwd.select(theAc.uuid, 'desc', function (pwdlst) {
                                        function _d() {
                                            if (pwdlst.length) {
                                                var pwd = pwdlst.shift();
                                                DbPwd.del(pwd.uuid, _d);
                                            } else {
                                                DbAc.del(theAc.uuid,function () {
                                                    mAlert('操作成功', function () {
                                                        refLst();
                                                    });
                                                });
                                            }
                                        }
                                        _d();
                                    });
                                }
                            });
                        } else if (tmenu[ind] == '移动分组') {
                            mSel('请选择要移动到的分组', glst, function (c) {
                                var fz = groupLst[c];
                                if (fz.uuid != acLst[indx].groupId) {
                                    theAc.groupId = fz.uuid;
                                    DbAc.update(theAc, SysState.mainKey.get(), function () {
                                        mAlert('操作成功', function () {
                                            refLst();
                                        });
                                    });

                                }
                            });
                        } else if (tmenu[ind] == '修改密码') {
                            loadPage('pwdEdit', {
                                ac: theAc
                            });
                        } else if (tmenu[ind] == '查看历史密码') {
                            loadPage('pwdHis', {
                                ac: theAc
                            });
                        }
                    });
                });
                return false;
            });
        });
        
    }
    initTitle(theAcLst ? "search" : theGroup.name, function () { pageGoBack(true); }, theAcLst ? null : function () {
        if (SysState.showLock) {
            Unlock();
            return;
        }
        loadPage('acAdd', {
            g: theGroup
        });
    });
}