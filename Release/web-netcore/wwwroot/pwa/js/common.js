var BASE64_MAPPING = [
		'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
		'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
		'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
		'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
		'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
		'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
		'w', 'x', 'y', 'z', '0', '1', '2', '3',
		'4', '5', '6', '7', '8', '9', '+', '/'
];
function uuid() {
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = "";//-

    var guid = s.join("");
    var binaryArray = [];
    for (var i = 0; i < 16; i++) {
        var j = i;
        if (i < 4) {
            j = 3 - i;
        } else if (i < 6) {
            j = 9 - i;
        } else if (i < 8) {
            j = 13 - i;
        }
        var d = parseInt(guid.substr(j * 2, 2), 16);
        binaryArray.push(d);
    }
    var base64 = '';
    for (var i = 0; i < binaryArray.length; i += 3) {
        var x = binaryArray[i] + 1;
        if (i + 1 < binaryArray.length) {
            x *= (binaryArray[i + 1] + 1);
        }
        if (i + 2 < binaryArray.length) {
            x *= (binaryArray[i + 2] + 1);
        }
        base64 += BASE64_MAPPING[(x % 64)];
        x = parseInt(x / 64);
        base64 += BASE64_MAPPING[(x % 64)];
        if (i < 15) {
            x = parseInt(x / 64);
            base64 += BASE64_MAPPING[(x % 64)];
            x = parseInt(x / 64);
            base64 += BASE64_MAPPING[(x)];
        }
    }

    return base64;
}
function random(min, max) {
    return Math.floor(min + Math.random() * (max - min))+'';
}
Array.prototype.contains = function (obj) {
    var i = this.length;
    while (i--) {
        if (this[i] === obj) {
            return true;
        }
    }
    return false;
}
function SUrl() {
    return localStorage.getItem('serverUrl');
}
function SCode() {
    return localStorage.getItem('serverCode');
}
function GetQueryString(name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return unescape(r[2]); return null;
}
function hasSVG() {
    SVG_NS = 'http://www.w3.org/2000/svg';
    return !!document.createElementNS && !!document.createElementNS(SVG_NS, 'svg').createSVGRect;
}
$.fn.mClick = function (fun) {
    $(this).click(function () {
    	androidActionSound();
        var res=fun.apply(this);
        return res;
    });
};
$(function(){
	window.onerror = function (msg, url, line) {
	    mAlert("真不幸，又出错了\n"
            + "\n错误信息：" + msg
            + "\n所在文件：" + url
            + "\n错误行号：" + line);
    }
});