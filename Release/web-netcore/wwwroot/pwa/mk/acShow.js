var _acShow_theAc;
function initacShow(option) {
    var theAc = option.ac;
    var theConn = option.c;
    initTitle(theAc.title, pageGoBack);
    var showpwd = false;
    var w = $('html').width();
    $('.item input').width(w - 80);
    $('textarea').width(w - 46);
    var pwd;
    DbPwd.selectWithDecrypt(theAc.uuid, 'desc', SysState.mainKey.get(),function (dt) {
        pwd = dt[0];
    });
    $('#xs').mClick(function () {
        if (SysState.NotShowPwd) {
            androidShowPwd(pwd.pwd);
        } else {
            systemNotification(pwd.pwd, function () {
                if (!showpwd) {
                    $('#mm').val(pwd.pwd);
                    $('#xs').html('隐藏密码');
                    androidShowPwd(pwd.pwd);
                } else {
                    $('#mm').val('*****************');
                    $('#xs').html('显示密码');
                }
                showpwd = !showpwd;
            });
        }
    });
    $('#fs,#fs2').mClick(function () {
        var fs = ["账号+密码", "账号", "密码"];
        if (theAc.F2A) {
            fs.push("2FA");
        }
        mSel('选择要发送的内容', fs, function (ind) {
            var obj = {};
            if (ind == 0) {
                obj.type = 1;
                obj.v1 = theAc.uid;
                obj.v2 = pwd.pwd;
            } else {
                obj.type = 0;
                if (ind == 1) {
                    obj.v1 = theAc.uid;
                } else if (ind == 2) {
                    obj.v1 = pwd.pwd;
                } else {
                    obj.v1 = TOTP.getCode(theAc.F2A);
                }
            }
            send(JSON.stringify(obj));
        });
    });
    $('#fz').mClick(function () {
        var cmds = ["账号", "密码"];
        if (theAc.F2A) {
            cmds.push("2FA");
        }
        mSel('选择要复制的内容', cmds, function (ind) {
            if (ind == 0) {
                androidCopy(theAc.uid);
            } else if (ind == 1) {
                androidCopy(pwd.pwd);
            } else {
                androidCopy(TOTP.getCode(theAc.F2A));
            }
        });
    });
    $('#xgzh').mClick(function () {
        loadPage('acEdit', {
            ac: theAc
        });
    });
    $('#xgmm').mClick(function () {
        loadPage('pwdEdit', {
            ac: theAc
        });
    });
    function send(msg) {
        var conn = theConn;
        function mSend() {
            if (!conn) {
                DbConn.select(function (lst) {
                    if (lst.length == 0) {
                        mAlert('请先配置PC传输设备');
                    } else if (lst.length == 1) {
                        conn = lst[0];
                        mSend();
                    } else {
                        var lstnm = [];
                        for (var i = 0; i < lst.length; i++) {
                            lstnm.push(lst[i].title);
                        }
                        mSel('请选择要发送的设备', lstnm, function (ind) {
                            conn = lst[ind];
                            mSend();
                        });
                    }
                });
                return;
            }
            var nr = "";
            var tmpdz = conn.dz;
            try {
                nr = AES.Encrypt(conn.txmy, msg);
            } catch (e) {
                mAlert("AES加密错误" + e.message);
                return;
            }
            if (conn.lx == 1) {
                androidStBt(tmpdz, msg,conn.txmy);
            } else if (conn.lx == 2){
                var info = tmpdz.split(':');
                androidStWifi(info[0], parseInt(info[1]), msg, conn.txmy,null);
            }else if (conn.lx == 3){
                var info = tmpdz.split(':');
                androidStWifi(info[0], parseInt(info[1]), msg, conn.txmy,conn.code);
            }
        }
        mSend();
    }
    _acShow_theAc = theAc;
    resetAcShow();
}
function resetAcShow() {
    theAc = _acShow_theAc;
    if (!SysState.showLock) {
        $('#zh').val(theAc.uid);
        showF2A(theAc.F2A);
        $('#url').val(theAc.url);
        $('#email').val(theAc.eMail);
        $('#bz').val(theAc.summary);
        $('#mybtn1,#mybtn2').show();
        $('#mybtn3').hide();
    } else {
        $('#zh').val("***");
        hideF2A();
        $('#url').val("***");
        $('#email').val("***");
        $('#bz').val("***");
        $('#mm').val("***");
        $('#mybtn1,#mybtn2').hide();
        $('#mybtn3').show();
    }
}
var _f2a_Interval;
function showF2A(f2a) {
    if (!f2a)
        return;
    $('#show_f2a').val("");
    var ms2NextSecond = 1000 - (Date.now() % 1000);
    setTimeout(function () {
        function _show() {
            if ($('#show_f2a:visible').length > 0) {
                try {
                    var ttl = Math.floor(Date.now() / 1000 % 30);
                    $('#show_f2a').val(TOTP.getCode(f2a) + " (" + (30 - ttl) + ")");
                } catch (err) {
                    $('#show_f2a').val("ERROR");
                }
            }
            else {
                hideF2A();
            }
        }
        _show();
        _f2a_Interval = setInterval(_show, 1000);
    }, ms2NextSecond);
}
function hideF2A() {
    if (_f2a_Interval)
        clearInterval(_f2a_Interval);
    $('#show_f2a').val("");
}