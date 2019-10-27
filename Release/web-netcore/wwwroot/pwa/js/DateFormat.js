/**      
 * 对Date的扩展，将 Date 转化为指定格式的String      
 * 月(M)、日(d)、12小时(h)、24小时(H)、分(m)、秒(s)、周(E)、季度(q) 可以用 1-2 个占位符      
 * 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字)      
 * eg:      
 * (new Date()).pattern("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423      
 * (new Date()).pattern("yyyy-MM-dd E HH:mm:ss") ==> 2009-03-10 二 20:09:04      
 * (new Date()).pattern("yyyy-MM-dd EE hh:mm:ss") ==> 2009-03-10 周二 08:09:04      
 * (new Date()).pattern("yyyy-MM-dd EEE hh:mm:ss") ==> 2009-03-10 星期二 08:09:04      
 * (new Date()).pattern("yyyy-M-d h:m:s.S") ==> 2006-7-2 8:9:4.18      
 */
Date.prototype.pattern = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1, //月份         
        "d+": this.getDate(), //日         
        "h+": this.getHours() % 12 == 0 ? 12 : this.getHours() % 12, //小时         
        "H+": this.getHours(), //小时         
        "m+": this.getMinutes(), //分         
        "s+": this.getSeconds(), //秒         
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度         
        "S": this.getMilliseconds() //毫秒         
    };
    var week = {
        "0": "\u65e5",
        "1": "\u4e00",
        "2": "\u4e8c",
        "3": "\u4e09",
        "4": "\u56db",
        "5": "\u4e94",
        "6": "\u516d"
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    }
    if (/(E+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length > 2 ? "\u661f\u671f" : "\u5468") : "") + week[this.getDay() + ""]);
    }
    for (var k in o) {
        if (new RegExp("(" + k + ")").test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        }
    }
    return fmt;
}
Date.prototype.mydate = function () {
    var year = this.getFullYear();
    var month = this.getMonth();
    var day = this.getDate();
    return new Date(year, month, day);
}
Date.prototype.AddDay = function (num) {
    return new Date(this.getTime() + num * 3600 * 24*1000);
}
function getMonthFirstDay(dt) {
    var date_ = dt;
    if (!dt) {
        date_ = new Date();
    }
    var year = date_.getFullYear();
    var month = date_.getMonth();
    return new Date(year, month, 1);
}
function getMonthLastDay(dt) {
    var date_ = dt;
    if (!dt) {
        date_ = new Date();
    }
    var year = date_.getFullYear();
    var month = date_.getMonth();
    return new Date(year, month + 1, 0);
}
function getMonthLastDayStr(dt) {
    return getMonthLastDay(dt).pattern("yyyy-MM-dd");
}
function getMonthFirstDayStr(dt) {
    return getMonthFirstDay(dt).pattern("yyyy-MM-dd");
}

function str2date(str) {
    var ss = str.split('-');
    return new Date(parseInt(ss[0]), parseInt(ss[1])-1, parseInt(ss[2]));
}

function serverStr2date(str) {
    var ss1 = str.split('.')[0].split('T');
    var ss2 = ss1[0].split('-');
    var ss3 = ss1[1].split(':');
    return new Date(parseInt(ss2[0]), parseInt(ss2[1]) - 1, parseInt(ss2[2]), parseInt(ss3[0]), parseInt(ss3[1]), parseInt(ss3[2]));
}