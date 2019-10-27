mAlert = function (title, msg, callback) {
    var ms = msg;
    if (!msg || typeof (msg) == 'function') {
        ms = title;
        title = '系统消息';
    }
    $('#sstcktt').html(title);
    $('#tcxxtx').show().html(ms);
    $('#gjz,#sqx,#tcxzk').hide();
    var cb = callback ? callback : msg;
    $('#sstckzzc').unbind('click').mClick(function () {
        $('#sstckzzc,#sstck').hide();
        if (typeof (cb) == 'function') {
            cb();
        }
    });
    $('#sqd').show().unbind('click').mClick(function () {
        $('#sstckzzc,#sstck').hide();
        if (typeof (cb) == 'function') {
            cb();
        }
    });
    $('#sstck,#sstckzzc,#sstckbtn').show();
    var h = $('#sstck').height();
    $('#sstck').css({
        "margin-top": (h / 2 * (-1)) + "px"
    });
    $('#sqd').html('确定');
    $('#sqx').html('取消');
}
mSimpDlg=function(title,msg,callback,btn1,btn2){
	var ms = msg;
    if (!msg || typeof (msg) == 'function') {
        ms = title;
        title = '系统消息';
    }
    $('#sstcktt').html(title);
    $('#tcxxtx').show().html(ms);
    $('#gjz,#tcxzk').hide();
    
    var cb = callback ? callback : msg;
    $('#sqd,#sqx').show().unbind('click').mClick(function () {
        $('#sstckzzc,#sstck').hide();
        cb(this.id == 'sqd'?1:2);
    });
    $('#sstckzzc').unbind('click').mClick(function () {
        $('#sstckzzc,#sstck').hide();
        cb(0);
    });
    $('#sstck,#sstckzzc,#sstckbtn').show();
    var h = $('#sstck').height();
    $('#sstck').css({
        "margin-top": (h / 2 * (-1)) + "px"
    });
    
    $('#sqd').html(btn1);
    if(btn2){
    	$('#sqx').html(btn2);
    }else{
    	$('#sqx').hide();
    }
}
mConfirm = function (title, msg, callback) {
    var ms = msg;
    if (!msg || typeof (msg) == 'function') {
        ms = title;
        title = '系统消息';
    }
    $('#sstcktt').html(title);
    $('#tcxxtx').show().html(ms);
    $('#gjz,#tcxzk').hide();
    var cb = callback ? callback : msg;
    $('#sqd,#sqx').show().unbind('click').mClick(function () {
        $('#sstckzzc,#sstck').hide();
        cb(this.id == 'sqd');
    });
    $('#sstckzzc').unbind('click').mClick(function () {
        $('#sstckzzc,#sstck').hide();
        cb(false);
    });
    $('#sstck,#sstckzzc,#sstckbtn').show();
    var h = $('#sstck').height();
    $('#sstck').css({
        "margin-top": (h / 2 * (-1)) + "px"
    });
    $('#sqd').html('确定');
    $('#sqx').html('取消');
}
mGetInput = function (msg, callback,oval) {
    $('#sstcktt').html(msg);
    $('#tcxxtx,#tcxzk').hide();
    $('#gjz').val(typeof(oval)=='undefined'?'':oval).show();
    var cb = callback;
    $('#sstckzzc').unbind('click').mClick(function () {
        $('#sstckzzc,#sstck').hide();
    });
    $('#gjz').unbind('keydown').bind('keydown',function(e){
    	 if(!e) e = window.event;//火狐中是 window.event
         if((e.keyCode || e.which) == 13){
        	 $('#sqd').click();
         }
    });
    $('#sqd,#sqx').show().unbind('click').mClick(function () {
        var val = $('#gjz').val();
        if (this.id == 'sqd'&&val === "") {
            mAlert("输入内容不能为空", function () {
                mGetInput(msg, callback);
            });
            return;
        }
        $('#sstckzzc,#sstck').hide();
        if (this.id == 'sqd')
        	cb(val);
    });
    $('#sstck,#sstckzzc,#sstckbtn').show();
    var h = $('#sstck').height();
    $('#sstck').css({
        "margin-top": (h / 2 * (-1)) + "px"
    });
    $('#sqd').html('确定');
    $('#sqx').html('取消');
}
mSel = function (msg,so,callback) {
    $('#sstcktt').html(msg);
    $('#tcxxtx,#gjz,#sstckbtn').hide();
    $('#tcxzk').show();
    var str = "";
    for (var i = 0; i < so.length; i++) {
        str += "<li>" + so[i] + "</li>";
    }
    $('#tcxzk').html(str);
    $('#tcxzk li').mClick(function () {
        $('#sstckzzc,#sstck').hide();
        var ind = $('#tcxzk li').index(this);
        callback(ind);
    });
    $('#sstckzzc').unbind('click').mClick(function () {
        $('#sstckzzc,#sstck').hide();
        //callback(-1);
    });
    setBtnClickBG('#tcxzk li');
    $('#sstckzzc,#sstck').show();
    var h = $('#sstck').height();
    $('#sstck').css({
        "margin-top": (h / 2 * (-1)) + "px"
    });
    $('#sqd').html('确定');
    $('#sqx').html('取消');
}
function initUI() {
    if(SysState.UI.height){
    	var h=SysState.UI.height;
    	$('html').height(SysState.UI.height);
    }else{
    	$('html').height('100%');
        var h = $('html').height();
        SysState.UI.height=h;
    }
    $('#body').height(h - 41);
    if (!hasSVG()) {
        $('#ttleft').css({
            'background': "url('images/fh.png')",
            'background-size': "100% 100%"
        });
        $('#ttg').css({
            'background': "url('images/g.png')",
            'background-size': "100% 100%"
        });
        $('#ttright').css({
            'background': "url('images/gd.png')",
            'background-size': "100% 100%"
        });
    }
}
function clickSound() {
    try {
        $('#clickSound')[0].play();
    }
    catch (err) {
    }
}

function systemNotification(msg, failedCallback) {
    if (!failedCallback)
        failedCallback = function () { };

    Notification.requestPermission(function (result) {
        if (result === 'granted') {
            navigator.serviceWorker.ready.then(function (registration) {
                registration.showNotification(msg);
            });
        } else {
            failedCallback();
        }
    });


    //if (window.Notification && Notification.permission !== "denied") {
    //    Notification.requestPermission(function (status) {
    //        if (status === "granted") {
    //            var n = new Notification('KeepPwd', { body: msg });
    //        } else {
    //            failedCallback();
    //        }
    //    });
    //} else {
    //    failedCallback();
    //}
}


function initTitle(title, leftfun, rightfun) {
    $('#title span').html(title);
    if (leftfun) {
        $('#ttleft').show().unbind('click').mClick(leftfun);
    } else {
        $('#ttleft').hide()
    }
    if (rightfun) {
        $('#ttright').show().unbind('click').mClick(rightfun);
    } else {
        $('#ttright').hide();
    }
}
function setBtnClickBG(id) {
    jQuery(id).mousedown(function () {
        jQuery(this).css("background", "#546ec6");
    }).mouseup(function () {
        jQuery(this).css("background", "#000");
    }).each(function () {
        this.addEventListener('touchstart', function (event) {
            jQuery(this).css("background", "#546ec6");
        }, false);
        this.addEventListener('touchend', function (event) {
            jQuery(this).css("background", "#000");
        }, false);
    });
}
var uijsq = 0;
function showWaitDlg() {
    uijsq++;
    $('#sstckzzc2,#sstckdddh').show();
}
function hideWaitDlg() {
    uijsq--;
    if (uijsq == 0)
        $('#sstckzzc2,#sstckdddh').hide();
}
JSONP.start = function () {
    showWaitDlg();
}
JSONP.end = function () {
    hideWaitDlg();
}
$(document).ajaxStart(function () {
    showWaitDlg();
});
$(document).ajaxStop(function () {
    hideWaitDlg();
});
