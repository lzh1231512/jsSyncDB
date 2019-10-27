var isIE = !!window.ActiveXObject;
JSONP = {
    start: null,
    end:null,
    getScript: function (url, callback, scriptId) {//script脚本延迟载入工具
        var script = document.createElement('script');
        script.type = 'text/javascript';
        if (scriptId != undefined && typeof scriptId == 'string') {
            script.setAttribute('id', scriptId);
        }
        var onloadfn = callback;//回调函数
        if (isIE) { //for IE
            script.onreadystatechange = function () {
                if (script.readyState == 'loaded' || script.readyState == 'complete') {
                    script.onreadystatechange = null;
                    if (onloadfn) {
                        setTimeout(onloadfn, 100);
                    }
                }
            };
        } else {
            script.onerror = function () {
                script.onerror = null;
                if (onloadfn)
                    onloadfn();
            };
        }
        script.src = url;
        document.body.appendChild(script);
    },
    getJSONP: function (obj) { //跨域通信，script标签方式，兼容IE和FF\CHROME
        if (JSONP.start) {
            JSONP.start();
        }
        var url = obj.url,
            success = obj.success,
            error = obj.error;
        var defCallfn = obj.callbackName;
        if (url.indexOf('?') > -1) {
            url += '&';
        } else {
            url += '?';
        }
        if (!defCallfn)
            defCallfn = "fun" + uuid();
        url += "callback=" + defCallfn + "&q=" + new Date().getTime();
        var scriptId = uuid() + '-' + new Date().getTime();
        window[defCallfn] = function () {
            document.getElementById(scriptId).setAttribute('guid', scriptId);
            success.apply(null, arguments);
            window[defCallfn] = null;
            if (JSONP.end) {
                JSONP.end();
            }
            if (!isIE) {
            		$('#'+scriptId).remove();
            }
        };
        var JSONPLoaded = function () {
            if (isIE) {//IE
                if (document.getElementById(scriptId).getAttribute('guid') != scriptId) {
                    error();
                    if (JSONP.end) {
                        JSONP.end();
                    }
                }
            } else {
                error();
                if (JSONP.end) {
                    JSONP.end();
                }
            }
            window[defCallfn] = null;
            $('#'+scriptId).remove();
        };
        JSONP.getScript(url, JSONPLoaded, scriptId);
    }
}



