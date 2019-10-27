this.addEventListener('install', function (event) {
    var version = 'v0.2';
    event.waitUntil(caches.delete('caches'));
    event.waitUntil(
        caches.open('caches').then(function (cache) {
            return cache.addAll([
                '../sound/kr.ogg',
                '../pwa/android-icon-144x144.png',
                '../pwa/android-icon-192x192.png',
                '../pwa/android-icon-36x36.png',
                '../pwa/android-icon-48x48.png',
                '../pwa/android-icon-72x72.png',
                '../pwa/android-icon-96x96.png',
                '../pwa/apple-icon-114x114.png',
                '../pwa/apple-icon-120x120.png',
                '../pwa/apple-icon-144x144.png',
                '../pwa/apple-icon-152x152.png',
                '../pwa/apple-icon-180x180.png',
                '../pwa/apple-icon-57x57.png',
                '../pwa/apple-icon-60x60.png',
                '../pwa/apple-icon-72x72.png',
                '../pwa/apple-icon-76x76.png',
                '../pwa/apple-icon-precomposed.png',
                '../pwa/apple-icon.png',
                '../pwa/browserconfig.xml',
                '../pwa/favicon-16x16.png',
                '../pwa/favicon-32x32.png',
                '../pwa/favicon-96x96.png',
                '../pwa/favicon.ico',
                '../pwa/manifest.json',
                '../pwa/ms-icon-144x144.png',
                '../pwa/ms-icon-150x150.png',
                '../pwa/ms-icon-310x310.png',
                '../pwa/ms-icon-70x70.png',
                '../css/all.css',
                '../css/tck.css',
                '../images/bluetooth.png',
                '../images/bluetooth.svg',
                '../images/fh.png',
                '../images/fh.svg',
                '../images/g.png',
                '../images/g.svg',
                '../images/gd.png',
                '../images/gd.svg',
                '../images/set.png',
                '../images/set.svg',
                '../images/wait.gif',
                '../js/ui/ui.js',
                '../js/patternLock/patternLock.css', 
                '../js/patternLock/patternLock.js',
                '../js/db/db.js',
                '../js/db/DbAc.js',
                '../js/db/DbConn.js',
                '../js/db/DbGroup.js',
                '../js/db/DbPwd.js',
                '../js/CryptoJSv3.1.2/aes.js',
                '../js/CryptoJSv3.1.2/main.js',
                '../js/CryptoJSv3.1.2/mode-ecb-min.js',
                '../js/android.js',
                '../js/common.js',
                '../js/DateFormat.js',
                '../js/htmlcache.js',
                '../js/interface.js',
                '../js/jquery-1.8.0.min.js',
                '../js/jsBridge.js',
                '../js/jsonp.js',
                '../js/JssDB-1.1.min.js',
                '../js/mk.js',
                '../js/sha1.js',
                '../js/sysState.js',
                '../js/totp.js',
                '../mk/ac.html',
                '../mk/ac.js',
                '../mk/acAdd.html',
                '../mk/acAdd.js',
                '../mk/acEdit.html',
                '../mk/acEdit.js',
                '../mk/acShow.html',
                '../mk/acShow.js',
                '../mk/connEdit.html',
                '../mk/connEdit.js',
                '../mk/connLst.html',
                '../mk/connLst.js',
                '../mk/initmainkey.html',
                '../mk/initmainkey.js',
                '../mk/login.html',
                '../mk/login.js',
                '../mk/main.html',
                '../mk/main.js',
                '../mk/mainSync.js',
                '../mk/pwdEdit.html',
                '../mk/pwdEdit.js',
                '../mk/pwdHis.html',
                '../mk/pwdHis.js',
                '../mk/randomPwd.html',
                '../mk/randomPwd.js',
                '../mk/serverSet.html',
                '../mk/serverSet.js',
                './index.html'
            ]);
        })
    );
});
this.addEventListener('fetch', function (event) {
    event.respondWith(caches.match(event.request).then(function (response) {
        if (response) {
            return response;
        } else {
            return fetch(event.request).then(function (response) {
                return response;
            });
        }
    }));
});