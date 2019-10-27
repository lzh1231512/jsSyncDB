function initRandomPwd(option) {
    initTitle('生成随机密码', pageGoBack);
    setBtnClickBG('#xzws');
    var pwdlen = 14;
    var tszf = localStorage.getItem('tszf');
    if (!tszf)
        tszf = '~!@#$%^&*()_+';
    var m1 = "0123456789";
    var m2 = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    var m3 = "abcdefghijkmnpqrstuvwxyz";
    var m4;
    $('#tszf').val(tszf);
    $('#xzws').mClick(function () {
        var sz = [];
        for (var i = 6; i < 19; i++) {
            sz.push(i + '位密码');
        }
        mSel('请选择密码位数', sz, function (r) {
            pwdlen = r + 6;
            $('#xzws').html(pwdlen + '位密码');
        });
    });
    $('#qd').mClick(function () {
        var c1 = $('#c1')[0].checked;
        var c2 = $('#c2')[0].checked;
        var c3 = $('#c3')[0].checked;
        var c4 = $('#c4')[0].checked;
        if (!c1 && !c2 && !c3 && !c4) {
            mAlert('你TM在逗我');
            return;
        }
        if (c4) {
            var tszf = $('#tszf').val();
            if (!tszf) {
                mAlert('特殊字符既然选了，好歹填一个啊');
                return;
            }
            localStorage.setItem('tszf', tszf);
            m4 = tszf;
        }
        var q = (c1 ? 1 : 0) + (c2 ? 1 : 0) + (c3 ? 1 : 0) + (c4 ? 1 : 0);
        var k = [];
        var mflag = 0;
        for (var i = 0; i < q; i++) {
            mflag += Math.pow(10, i);
        }
        var res = "";
        while (true) {
            var flag = 0;
            for (var i = 0; i < pwdlen; i++) {
                k[i] = parseInt(Math.random() * q);
                if (t(flag, k[i]) == 0) {
                    flag += Math.pow(10, k[i]);
                }
            }
            if (mflag == flag) {
                res = "";
                for (var i = 0; i < pwdlen; i++) {
                    var x = 0;
                    if (c1) {
                        if (k[i] == x) {
                            res += getp(m1);
                            continue;
                        }
                        x++;
                    }
                    if (c2) {
                        if (k[i] == x) {
                            res += getp(m2);
                            continue;
                        }
                        x++;
                    }
                    if (c3) {
                        if (k[i] == x) {
                            res += getp(m3);
                            continue;
                        }
                        x++;
                    }
                    if (c4) {
                        if (k[i] == x) {
                            res += getp(m4);
                            continue;
                        }
                        x++;
                    }
                }
                break;
            }
        }
        pageGoBack();
        option.cb(res);
    });
    function t(x, y) {
        x = x % (parseInt(Math.pow(10, y + 1)));
        if (y > 0)
            x = x / (parseInt(Math.pow(10, y)));
        return x;
    }

    function getp(str) {
        var i = parseInt(Math.random() * (str.length));
        return str.charAt(i);
    }
}
